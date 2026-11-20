// Share-link pages, which anyone with the link opens: no user middleware.
// The token is the only key, and only what the page shows leaves here.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sharedPlaylist, sharedSong } from "@/server/share";

const tokenInput = z.object({ token: z.string().max(64) }).strict();

export const getSharedSong = createServerFn()
  .validator((data: unknown) => tokenInput.parse(data))
  .handler(async ({ data }) => {
    const song = await sharedSong(data.token);
    if (!song) return null;
    return {
      title: song.title,
      style: song.style,
      lyrics: song.lyrics,
      playable: song.status === "ready" && Boolean(song.audioKey),
    };
  });

export const getSharedPlaylist = createServerFn()
  .validator((data: unknown) => tokenInput.parse(data))
  .handler(async ({ data }) => {
    const playlist = await sharedPlaylist(data.token);
    if (!playlist) return null;
    return {
      name: playlist.name,
      description: playlist.description,
      songs: playlist.songs.map(({ n, title, style }) => ({ n, title, style })),
    };
  });
