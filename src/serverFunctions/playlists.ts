import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import * as playlists from "@/server/playlists";

function origin() {
  return new URL(getRequest().url).origin;
}

export const getPlaylists = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(({ context: { user } }) => playlists.listPlaylists(user.id));

export const getPlaylistPage = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => playlists.playlistIdInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const playlist = await playlists.getPlaylist(user.id, data.id);
    if (!playlist) return null;
    const { shareToken, ...rest } = playlist;
    return { ...rest, shareUrl: shareToken ? `${origin()}/s/list/${shareToken}` : null };
  });

export const createPlaylist = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => playlists.createPlaylistInput.parse(data))
  .handler(({ data, context: { user } }) => playlists.createPlaylist(user.id, data));

export const updatePlaylist = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => playlists.updatePlaylistInput.parse(data))
  .handler(({ data, context: { user } }) => playlists.updatePlaylist(user.id, data));

export const deletePlaylist = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => playlists.playlistIdInput.parse(data))
  .handler(({ data, context: { user } }) => playlists.deletePlaylist(user.id, data.id));

export const addSongsToPlaylist = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => playlists.addSongsInput.parse(data))
  .handler(({ data, context: { user } }) => playlists.addSongs(user.id, data));

export const removeFromPlaylist = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => playlists.playlistSongInput.parse(data))
  .handler(({ data, context: { user } }) => playlists.removeSong(user.id, data));

export const moveInPlaylist = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => playlists.moveSongInput.parse(data))
  .handler(({ data, context: { user } }) => playlists.moveSong(user.id, data));

export const sharePlaylist = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => playlists.sharePlaylistInput.parse(data))
  .handler(async ({ data, context: { user } }) => {
    const token = await playlists.setPlaylistShare(user.id, data);
    return { shareUrl: token ? `${origin()}/s/list/${token}` : null };
  });
