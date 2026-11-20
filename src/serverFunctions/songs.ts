import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { integrationStatus, isAdmin } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as songs from "@/server/songs";
import { rememberUser } from "@/server/users";

function origin() {
  return new URL(getRequest().url).origin;
}

/** Whether songs can be made, and for an admin, how to turn it on. */
export const getGeneration = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    let ready = false;
    let command: string | null = null;
    try {
      const status = await integrationStatus({ env, provider: "elevenlabs" });
      ready = status.ready;
      command = status.command ?? null;
    } catch (error) {
      console.error("Couldn't read the generation status", error);
    }
    return {
      ready,
      admin: isAdmin(user),
      command: isAdmin(user) ? (command ?? "everyapp provider add elevenlabs") : null,
    };
  });

export const getLibrary = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => songs.listSongsInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    await rememberUser(user);
    return songs.listSongs(user.id, data);
  });

export const getSongPage = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => songs.songIdInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const song = await songs.getSong(user.id, data.id);
    if (!song) return null;
    const { shareToken, ...rest } = song;
    return {
      song: rest,
      parent: await songs.parentOf(user.id, song),
      shareUrl: shareToken ? `${origin()}/s/song/${shareToken}` : null,
    };
  });

/** The source of a remix, for filling in the form. */
export const getRemixSource = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => songs.songIdInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const song = await songs.getSong(user.id, data.id);
    if (!song) return null;
    return {
      id: song.id,
      title: song.title,
      lyrics: song.lyrics,
      style: song.style,
      excludeStyles: song.excludeStyles,
      vocalGender: song.vocalGender,
      instrumental: song.instrumental,
      durationSec: song.durationSec,
      description: song.description,
    };
  });

export const createSong = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => songs.createSongInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    await rememberUser(user);
    const status = await integrationStatus({ env, provider: "elevenlabs" });
    if (!status.ready) throw new Error("Song generation isn't set up.");
    return songs.createSong({ id: user.id, orgId: user.orgId }, data);
  });

export const retrySong = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => songs.songIdInput.parse(data))
  .handler(({ data, context: { user } }) => songs.retrySong(user.id, data.id));

export const updateSong = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => songs.updateSongInput.parse(data))
  .handler(({ data, context: { user } }) => songs.updateSong(user.id, data));

export const setLiked = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => songs.likeInput.parse(data))
  .handler(({ data, context: { user } }) => songs.setLiked(user.id, data));

export const trashSongs = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => songs.songIdsInput.parse(data))
  .handler(({ data, context: { user } }) => songs.trashSongs(user.id, data.ids));

export const restoreSong = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => songs.songIdInput.parse(data))
  .handler(({ data, context: { user } }) => songs.restoreSong(user.id, data.id));

export const deleteSong = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => songs.songIdInput.parse(data))
  .handler(({ data, context: { user } }) => songs.deleteSong(user.id, data.id));

export const shareSong = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => songs.shareInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const token = await songs.setSongShare(user.id, data);
    return { shareUrl: token ? `${origin()}/s/song/${token}` : null };
  });

export type SongPage = NonNullable<Awaited<ReturnType<typeof getSongPage>>>;
