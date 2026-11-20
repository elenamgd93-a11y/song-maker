import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { db } from "@/db";
import { playlistSongs, songs } from "@/db/schema";
import { newShareToken } from "@/server/tokens";

export const STATUSES = ["queued", "generating", "ready", "failed"] as const;
export type SongStatus = (typeof STATUSES)[number];

const id = z.string().min(1).max(64);

export const createSongInput = z
  .object({
    mode: z.enum(["simple", "custom"]),
    title: z.string().trim().max(120).default(""),
    description: z.string().trim().max(1000).default(""),
    lyrics: z.string().trim().max(5000).default(""),
    style: z.string().trim().max(500).default(""),
    excludeStyles: z.string().trim().max(500).default(""),
    vocalGender: z.enum(["any", "male", "female"]).default("any"),
    instrumental: z.boolean().default(false),
    durationSec: z.number().int().min(10).max(300).nullable().default(null),
    parentSongId: id.nullable().default(null),
    remixKind: z.enum(["cover", "extend"]).nullable().default(null),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.mode === "simple" && !input.description) {
      ctx.addIssue({ code: "custom", message: "Describe the song." });
    }
    if (input.mode === "custom" && !input.lyrics && !input.instrumental && !input.description) {
      ctx.addIssue({ code: "custom", message: "Add lyrics, or make it instrumental." });
    }
    if (input.mode === "custom" && !input.style && !input.description) {
      ctx.addIssue({ code: "custom", message: "Add at least one style." });
    }
    if ((input.parentSongId === null) !== (input.remixKind === null)) {
      ctx.addIssue({ code: "custom", message: "A remix needs its source song." });
    }
  });

export const listSongsInput = z
  .object({
    q: z.string().trim().max(200).optional(),
    status: z.enum(STATUSES).optional(),
    view: z.enum(["all", "liked", "trash"]).default("all"),
  })
  .strict();

export const songIdInput = z.object({ id }).strict();
export const songIdsInput = z.object({ ids: z.array(id).min(1).max(200) }).strict();
export const updateSongInput = z
  .object({
    id,
    title: z.string().trim().min(1, "Give it a title.").max(120),
    lyrics: z.string().trim().max(5000),
  })
  .strict();
export const likeInput = z.object({ id, liked: z.boolean() }).strict();
export const shareInput = z.object({ id, on: z.boolean() }).strict();

export class NotFoundError extends Error {
  constructor(what = "Song") {
    super(`${what} not found`);
  }
}

/** A song as its owner sees it. */
export interface Song {
  id: string;
  title: string;
  mode: "simple" | "custom";
  description: string;
  lyrics: string;
  style: string;
  excludeStyles: string;
  vocalGender: "any" | "male" | "female";
  instrumental: boolean;
  durationSec: number | null;
  status: SongStatus;
  error: string | null;
  liked: boolean;
  trashed: boolean;
  shareToken: string | null;
  remixKind: "cover" | "extend" | null;
  parentSongId: string | null;
  createdAt: number;
}

const shown = {
  id: songs.id,
  title: songs.title,
  mode: songs.mode,
  description: songs.description,
  lyrics: songs.lyrics,
  style: songs.style,
  excludeStyles: songs.excludeStyles,
  vocalGender: songs.vocalGender,
  instrumental: songs.instrumental,
  durationSec: songs.durationSec,
  status: songs.status,
  error: songs.error,
  liked: songs.liked,
  trashed: sql<boolean>`${songs.trashedAt} is not null`.mapWith(Boolean),
  shareToken: songs.shareToken,
  remixKind: songs.remixKind,
  parentSongId: songs.parentSongId,
  createdAt: songs.createdAt,
};

/** A title from the first words of a description. */
export function titleFrom(description: string): string {
  const words = description.replace(/\s+/g, " ").trim().split(" ");
  let title = "";
  for (const word of words) {
    if (title && (title + " " + word).length > 60) break;
    title = title ? `${title} ${word}` : word;
  }
  title = title.slice(0, 60);
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : "Untitled";
}

export async function listSongs(
  ownerId: string,
  { q, status, view }: z.infer<typeof listSongsInput>,
): Promise<Song[]> {
  const conditions = [eq(songs.ownerId, ownerId)];
  conditions.push(view === "trash" ? isNotNull(songs.trashedAt) : isNull(songs.trashedAt));
  if (view === "liked") conditions.push(eq(songs.liked, true));
  if (status) conditions.push(eq(songs.status, status));
  if (q) {
    const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    conditions.push(
      or(
        sql`${songs.title} like ${pattern} escape '\\'`,
        sql`${songs.lyrics} like ${pattern} escape '\\'`,
        sql`${songs.style} like ${pattern} escape '\\'`,
      )!,
    );
  }
  return db
    .select(shown)
    .from(songs)
    .where(and(...conditions))
    .orderBy(desc(songs.createdAt), desc(songs.id))
    .limit(500);
}

/** The owner's song, or null. */
export async function getSong(ownerId: string, songId: string): Promise<Song | null> {
  const [song] = await db
    .select(shown)
    .from(songs)
    .where(and(eq(songs.id, songId), eq(songs.ownerId, ownerId)));
  return song ?? null;
}

/** The title of the song a remix came from, while the same owner still has it. */
export async function parentOf(ownerId: string, song: Song) {
  if (!song.parentSongId) return null;
  const parent = await getSong(ownerId, song.parentSongId);
  return parent ? { id: parent.id, title: parent.title } : null;
}

export async function createSong(
  owner: { id: string; orgId: string },
  input: z.infer<typeof createSongInput>,
): Promise<{ id: string }> {
  if (input.parentSongId && !(await getSong(owner.id, input.parentSongId))) {
    throw new NotFoundError();
  }
  const songId = crypto.randomUUID();
  const title = input.title || titleFrom(input.description || input.lyrics || input.style);
  await db.insert(songs).values({
    id: songId,
    ownerId: owner.id,
    orgId: owner.orgId,
    title,
    mode: input.mode,
    description: input.description,
    lyrics: input.mode === "custom" && !input.instrumental ? input.lyrics : "",
    style: input.mode === "custom" ? input.style : "",
    excludeStyles: input.mode === "custom" ? input.excludeStyles : "",
    vocalGender: input.mode === "custom" ? input.vocalGender : "any",
    instrumental: input.instrumental,
    durationSec: input.mode === "custom" ? input.durationSec : null,
    parentSongId: input.parentSongId,
    remixKind: input.remixKind,
    status: "queued",
    createdAt: Date.now(),
  });
  await env.SONG_JOBS.send({ songId });
  return { id: songId };
}

/** Puts a failed song back in the queue. */
export async function retrySong(ownerId: string, songId: string) {
  const [song] = await db
    .update(songs)
    .set({ status: "queued", error: null })
    .where(and(eq(songs.id, songId), eq(songs.ownerId, ownerId), eq(songs.status, "failed")))
    .returning({ id: songs.id });
  if (!song) throw new NotFoundError();
  await env.SONG_JOBS.send({ songId });
}

export async function updateSong(ownerId: string, { id: songId, title, lyrics }: z.infer<typeof updateSongInput>) {
  const [song] = await db
    .update(songs)
    .set({ title, lyrics })
    .where(and(eq(songs.id, songId), eq(songs.ownerId, ownerId)))
    .returning({ id: songs.id });
  if (!song) throw new NotFoundError();
}

export async function setLiked(ownerId: string, { id: songId, liked }: z.infer<typeof likeInput>) {
  const [song] = await db
    .update(songs)
    .set({ liked })
    .where(and(eq(songs.id, songId), eq(songs.ownerId, ownerId)))
    .returning({ id: songs.id });
  if (!song) throw new NotFoundError();
}

/** Moves the owner's songs among `ids` to the trash; returns how many. */
export async function trashSongs(ownerId: string, ids: string[]): Promise<number> {
  const moved = await db
    .update(songs)
    .set({ trashedAt: Date.now() })
    .where(and(inArray(songs.id, ids), eq(songs.ownerId, ownerId), isNull(songs.trashedAt)))
    .returning({ id: songs.id });
  return moved.length;
}

export async function restoreSong(ownerId: string, songId: string) {
  const [song] = await db
    .update(songs)
    .set({ trashedAt: null })
    .where(and(eq(songs.id, songId), eq(songs.ownerId, ownerId)))
    .returning({ id: songs.id });
  if (!song) throw new NotFoundError();
}

/** Deletes the song, its place in playlists and its audio. */
export async function deleteSong(ownerId: string, songId: string) {
  const [song] = await db
    .select({ audioKey: songs.audioKey })
    .from(songs)
    .where(and(eq(songs.id, songId), eq(songs.ownerId, ownerId)));
  if (!song) throw new NotFoundError();
  await db.batch([
    db.delete(playlistSongs).where(eq(playlistSongs.songId, songId)),
    db
      .update(songs)
      .set({ parentSongId: null })
      .where(and(eq(songs.parentSongId, songId), eq(songs.ownerId, ownerId))),
    db.delete(songs).where(and(eq(songs.id, songId), eq(songs.ownerId, ownerId))),
  ]);
  if (song.audioKey) await env.files.delete(song.audioKey);
}

/** Turns the share link on (always a new token) or off. */
export async function setSongShare(ownerId: string, { id: songId, on }: z.infer<typeof shareInput>) {
  const [song] = await db
    .update(songs)
    .set({ shareToken: on ? newShareToken() : null })
    .where(and(eq(songs.id, songId), eq(songs.ownerId, ownerId)))
    .returning({ shareToken: songs.shareToken });
  if (!song) throw new NotFoundError();
  return song.shareToken;
}

/** The owner's audio file for a ready song, or null. */
export async function songAudio(ownerId: string, songId: string) {
  const [song] = await db
    .select({ title: songs.title, audioKey: songs.audioKey })
    .from(songs)
    .where(and(eq(songs.id, songId), eq(songs.ownerId, ownerId), eq(songs.status, "ready")));
  if (!song?.audioKey) return null;
  const object = await env.files.get(song.audioKey);
  return object ? { title: song.title, object } : null;
}

