// What anyone with an active share link may see. A link that is off, or a
// song in the trash, is not found. No owner, email or id leaves here.
import { and, asc, eq, isNull } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { db } from "@/db";
import { playlistSongs, playlists, songs } from "@/db/schema";

const TOKEN = /^[A-Za-z0-9_-]{24}$/;

export async function sharedSong(token: string) {
  if (!TOKEN.test(token)) return null;
  const [song] = await db
    .select({
      title: songs.title,
      style: songs.style,
      lyrics: songs.lyrics,
      status: songs.status,
      audioKey: songs.audioKey,
    })
    .from(songs)
    .where(and(eq(songs.shareToken, token), isNull(songs.trashedAt)));
  return song ?? null;
}

async function sharedPlaylistRow(token: string) {
  if (!TOKEN.test(token)) return null;
  const [playlist] = await db
    .select({ id: playlists.id, ownerId: playlists.ownerId, name: playlists.name, description: playlists.description })
    .from(playlists)
    .where(eq(playlists.shareToken, token));
  return playlist ?? null;
}

/** The playlist's ready songs, numbered by their place in it. */
export async function sharedPlaylist(token: string) {
  const playlist = await sharedPlaylistRow(token);
  if (!playlist) return null;
  const rows = await db
    .select({ id: songs.id, title: songs.title, style: songs.style })
    .from(playlistSongs)
    .innerJoin(songs, eq(songs.id, playlistSongs.songId))
    .where(
      and(
        eq(playlistSongs.playlistId, playlist.id),
        eq(songs.ownerId, playlist.ownerId),
        eq(songs.status, "ready"),
        isNull(songs.trashedAt),
      ),
    )
    .orderBy(asc(playlistSongs.position));
  return {
    name: playlist.name,
    description: playlist.description,
    // The song's place in the list stands in for its id.
    songs: rows.map((row, index) => ({ n: index + 1, title: row.title, style: row.style, ref: row.id })),
  };
}

export async function sharedSongAudio(token: string) {
  const song = await sharedSong(token);
  if (!song || song.status !== "ready" || !song.audioKey) return null;
  const object = await env.files.get(song.audioKey);
  return object ? { title: song.title, object } : null;
}

/** The `n`th ready song of a shared playlist. */
export async function sharedPlaylistAudio(token: string, n: number) {
  const playlist = await sharedPlaylist(token);
  const song = playlist?.songs.find((entry) => entry.n === n);
  if (!song) return null;
  const [row] = await db.select({ audioKey: songs.audioKey }).from(songs).where(eq(songs.id, song.ref));
  if (!row?.audioKey) return null;
  const object = await env.files.get(row.audioKey);
  return object ? { title: song.title, object } : null;
}
