import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { gatewayRefusal, integrationFetch } from "@every-app/sdk/server";
import { db } from "@/db";
import { songs } from "@/db/schema";

const MUSIC_URL = "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128";
const DEFAULT_LENGTH_SEC = 120;
const SECTION_MIN_MS = 3_000;
const SECTION_MAX_MS = 120_000;

type SongRow = typeof songs.$inferSelect;

function list(text: string): string[] {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 20);
}

/** Lyrics as sections: a `[Name]` line starts one, and so does a blank line. */
function sections(lyrics: string) {
  const found: { name: string; lines: string[] }[] = [];
  let current: { name: string; lines: string[] } | null = null;
  for (const raw of lyrics.split("\n")) {
    const line = raw.trim();
    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      current = { name: header[1]!.slice(0, 100), lines: [] };
      found.push(current);
    } else if (!line) {
      current = null;
    } else {
      if (!current) {
        current = { name: `Part ${found.length + 1}`, lines: [] };
        found.push(current);
      }
      current.lines.push(line.slice(0, 200));
    }
  }
  return found.filter((section) => section.lines.length > 0).slice(0, 30);
}

/** What the music endpoint is sent for a song. */
export function musicRequest(song: SongRow) {
  if (song.mode === "simple") {
    return {
      model_id: "music_v1",
      prompt: song.description,
      force_instrumental: song.instrumental,
    };
  }
  const positive = list(song.style);
  if (song.description) positive.push(song.description.slice(0, 200));
  if (!song.instrumental && song.vocalGender !== "any") {
    positive.push(`${song.vocalGender} vocals`);
  }
  const negative = list(song.excludeStyles);
  if (song.instrumental) negative.push("vocals");
  const parts = song.instrumental || !song.lyrics
    ? [{ name: "Instrumental", lines: [] as string[] }]
    : sections(song.lyrics);
  const totalMs = (song.durationSec ?? DEFAULT_LENGTH_SEC) * 1000;
  const each = Math.min(
    SECTION_MAX_MS,
    Math.max(SECTION_MIN_MS, Math.floor(totalMs / parts.length)),
  );
  return {
    model_id: "music_v1",
    composition_plan: {
      positive_global_styles: positive,
      negative_global_styles: negative,
      sections: parts.map((part) => ({
        section_name: part.name,
        positive_local_styles: [],
        negative_local_styles: [],
        duration_ms: each,
        lines: part.lines,
      })),
    },
  };
}

async function failureReason(response: Response): Promise<string> {
  const refusal = await gatewayRefusal(response.clone());
  if (refusal) {
    return refusal.code === "integration_not_configured"
      ? "Song generation isn't set up."
      : refusal.message;
  }
  const body: unknown = await response.json().catch(() => null);
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail.slice(0, 300);
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message).slice(0, 300);
  }
  return `The music service answered ${response.status}.`;
}

/** Runs one queued song: generating, then ready with audio, or failed with a reason. */
export async function runSongJob(songId: string): Promise<void> {
  const [song] = await db
    .update(songs)
    .set({ status: "generating", error: null })
    .where(and(eq(songs.id, songId), eq(songs.status, "queued")))
    .returning();
  if (!song) return;

  let error: string | null = null;
  let audio: ArrayBuffer | null = null;
  try {
    const music = integrationFetch({
      env,
      provider: "elevenlabs",
      for: { background: true, organizationId: song.orgId },
    });
    const response = await music(MUSIC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(musicRequest(song)),
    });
    if (response.ok) audio = await response.arrayBuffer();
    else error = await failureReason(response);
  } catch (cause) {
    console.error("Song generation failed", cause);
    error = "The music service couldn't be reached.";
  }

  if (!audio) {
    await db
      .update(songs)
      .set({ status: "failed", error })
      .where(eq(songs.id, songId));
    return;
  }
  const key = `songs/${song.ownerId}/${song.id}.mp3`;
  try {
    await env.files.put(key, audio, { httpMetadata: { contentType: "audio/mpeg" } });
  } catch (cause) {
    console.error("Couldn't store a song's audio", cause);
    await db
      .update(songs)
      .set({ status: "failed", error: "The audio couldn't be saved." })
      .where(eq(songs.id, songId));
    return;
  }
  const [saved] = await db
    .update(songs)
    .set({ status: "ready", audioKey: key, error: null })
    .where(eq(songs.id, songId))
    .returning({ id: songs.id });
  // Deleted while it was generating.
  if (!saved) await env.files.delete(key);
}
