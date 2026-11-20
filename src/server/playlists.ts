import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { playlistSongs, playlists, songs } from "@/db/schema";
import { NotFoundError } from "@/server/songs";
import { newShareToken } from "@/server/tokens";

const id = z.string().min(1).max(64);
const name = z.string().trim().min(1, "Give it a name.").max(100);
const description = z.string().trim().max(500).default("");

export const createPlaylistInput = z.object({ name, description }).strict();
export const updatePlaylistInput = z.object({ id, name, description }).strict();
export const playlistIdInput = z.object({ id }).strict();
export const addSongsInput = z
  .object({ playlistId: id, songIds: z.array(id).min(1).max(200) })
  .strict();
export const playlistSongInput = z.object({ playlistId: id, songId: id }).strict();
export const moveSongInput = z
  .object({ playlistId: id, songId: id, direction: z.enum(["up", "down"]) })
  .strict();
export const sharePlaylistInput = z.object({ id, on: z.boolean() }).strict();

export interface PlaylistSummary {
  id: string;
  name: string;
  description: string;
  songCount: number;
}

export function listPlaylists(ownerId: string): Promise<PlaylistSummary[]> {
  return db
    .select({
      id: playlists.id,
      name: playlists.name,
      description: playlists.description,
      songCount: sql<number>`(select count(*) from ${playlistSongs} where ${playlistSongs.playlistId} = ${playlists.id})`,
    })
    .from(playlists)
    .where(eq(playlists.ownerId, ownerId))
    .orderBy(desc(playlists.createdAt));
}

async function ownedPlaylist(ownerId: string, playlistId: string) {
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerId, ownerId)));
  if (!playlist) throw new NotFoundError("Playlist");
  return playlist;
}

/** The playlist with its songs in order, or null. */
export async function getPlaylist(ownerId: string, playlistId: string) {
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.ownerId, ownerId)));
  if (!playlist) return null;
  const items = await db
    .select({
      id: songs.id,
      title: songs.title,
      style: songs.style,
      status: songs.status,
      trashed: sql<boolean>`${songs.trashedAt} is not null`.mapWith(Boolean),
    })
    .from(playlistSongs)
    .innerJoin(songs, eq(songs.id, playlistSongs.songId))
    .where(and(eq(playlistSongs.playlistId, playlistId), eq(songs.ownerId, ownerId)))
    .orderBy(asc(playlistSongs.position));
  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    shareToken: playlist.shareToken,
    songs: items,
  };
}

export async function createPlaylist(ownerId: string, input: z.infer<typeof createPlaylistInput>) {
  const playlistId = crypto.randomUUID();
  await db.insert(playlists).values({
    id: playlistId,
    ownerId,
    name: input.name,
    description: input.description,
    createdAt: Date.now(),
  });
  return { id: playlistId };
}

export async function updatePlaylist(ownerId: string, input: z.infer<typeof updatePlaylistInput>) {
  const [playlist] = await db
    .update(playlists)
    .set({ name: input.name, description: input.description })
    .where(and(eq(playlists.id, input.id), eq(playlists.ownerId, ownerId)))
    .returning({ id: playlists.id });
  if (!playlist) throw new NotFoundError("Playlist");
}

/** Deletes the playlist; its songs stay in the library. */
export async function deletePlaylist(ownerId: string, playlistId: string) {
  await ownedPlaylist(ownerId, playlistId);
  await db.batch([
    db.delete(playlistSongs).where(eq(playlistSongs.playlistId, playlistId)),
    db.delete(playlists).where(and(eq(playlists.id, playlistId), eq(playlists.ownerId, ownerId))),
  ]);
}

/** Adds the owner's songs that aren't in the playlist yet, at its end. */
export async function addSongs(ownerId: string, input: z.infer<typeof addSongsInput>) {
  const playlist = await ownedPlaylist(ownerId, input.playlistId);
  const owned = await db
    .select({ id: songs.id, createdAt: songs.createdAt })
    .from(songs)
    .where(and(inArray(songs.id, input.songIds), eq(songs.ownerId, ownerId), isNull(songs.trashedAt)));
  const present = await db
    .select({ songId: playlistSongs.songId, position: playlistSongs.position })
    .from(playlistSongs)
    .where(eq(playlistSongs.playlistId, playlist.id));
  const already = new Set(present.map((row) => row.songId));
  // In the order they were picked.
  const order = new Map(input.songIds.map((songId, index) => [songId, index]));
  const toAdd = owned
    .filter((song) => !already.has(song.id))
    .sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  let next = present.reduce((max, row) => Math.max(max, row.position), -1) + 1;
  if (toAdd.length) {
    await db
      .insert(playlistSongs)
      .values(toAdd.map((song) => ({ playlistId: playlist.id, songId: song.id, position: next++ })))
      .onConflictDoNothing();
  }
  return { added: toAdd.length, name: playlist.name };
}

export async function removeSong(ownerId: string, input: z.infer<typeof playlistSongInput>) {
  await ownedPlaylist(ownerId, input.playlistId);
  await db
    .delete(playlistSongs)
    .where(and(eq(playlistSongs.playlistId, input.playlistId), eq(playlistSongs.songId, input.songId)));
}

/** Swaps the song with its neighbour, renumbering the list. */
export async function moveSong(ownerId: string, input: z.infer<typeof moveSongInput>) {
  await ownedPlaylist(ownerId, input.playlistId);
  const rows = await db
    .select({ songId: playlistSongs.songId })
    .from(playlistSongs)
    .where(eq(playlistSongs.playlistId, input.playlistId))
    .orderBy(asc(playlistSongs.position));
  const ids = rows.map((row) => row.songId);
  const from = ids.indexOf(input.songId);
  const to = input.direction === "up" ? from - 1 : from + 1;
  if (from < 0 || to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to]!, ids[from]!];
  const [first, ...rest] = ids.map((songId, position) =>
    db
      .update(playlistSongs)
      .set({ position })
      .where(and(eq(playlistSongs.playlistId, input.playlistId), eq(playlistSongs.songId, songId))),
  );
  await db.batch([first!, ...rest]);
}

export async function setPlaylistShare(ownerId: string, input: z.infer<typeof sharePlaylistInput>) {
  const [playlist] = await db
    .update(playlists)
    .set({ shareToken: input.on ? newShareToken() : null })
    .where(and(eq(playlists.id, input.id), eq(playlists.ownerId, ownerId)))
    .returning({ shareToken: playlists.shareToken });
  if (!playlist) throw new NotFoundError("Playlist");
  return playlist.shareToken;
}
