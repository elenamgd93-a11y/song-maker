import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ListMusic, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { PlaylistDialog } from "@/client/components/PlaylistDialog";
import { ShareControl } from "@/client/components/ShareControl";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { messageOf } from "@/client/lib/errors";
import { useRefreshWhile } from "@/client/lib/useRefreshWhile";
import {
  deletePlaylist,
  getPlaylistPage,
  moveInPlaylist,
  removeFromPlaylist,
  sharePlaylist,
  updatePlaylist,
} from "@/serverFunctions/playlists";

export const Route = createFileRoute("/playlists/$playlistId")({
  loader: async ({ params }) => {
    const page = await getPlaylistPage({ data: { id: params.playlistId } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? "Playlist not found"} · Song Maker` }],
  }),
  notFoundComponent: () => (
    <AppShell nav={<AppNav />}>
      <EmptyState
        kind="filtered"
        title="Playlist not found"
        action={
          <Link to="/playlists" className={buttonVariants({ variant: "outline" })}>
            All playlists
          </Link>
        }
      />
    </AppShell>
  ),
  component: PlaylistPage,
});

function PlaylistPage() {
  const playlist = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const playable = playlist.songs.filter((song) => song.status === "ready" && !song.trashed);
  useRefreshWhile(playlist.songs.some((song) => song.status === "queued" || song.status === "generating"));

  useEffect(() => {
    if (playing) void audio.current?.play().catch(() => undefined);
  }, [playing]);

  async function run(work: () => Promise<unknown>) {
    setPending(true);
    try {
      await work();
      await router.invalidate();
    } catch (error) {
      toast.error(messageOf(error));
    } finally {
      setPending(false);
    }
  }

  function playNext() {
    const index = playable.findIndex((song) => song.id === playing);
    setPlaying(playable[index + 1]?.id ?? null);
  }

  const id = playlist.id;
  const current = playable.find((song) => song.id === playing);

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={playlist.name}
        description={playlist.description || null}
        backLink={
          <Link to="/playlists" className="text-sm text-muted-foreground hover:text-foreground">
            Playlists
          </Link>
        }
        actions={
          <>
            <Button size="sm" disabled={playable.length === 0} onClick={() => setPlaying(playable[0]!.id)}>
              <Play aria-hidden />
              Play all
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </>
        }
      />

      {current ? (
        <div className="space-y-1 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">{current.title}</p>
          <audio
            ref={audio}
            controls
            src={`/api/songs/${current.id}/audio`}
            data-testid="playlist-audio"
            onEnded={playNext}
            className="w-full"
          />
        </div>
      ) : null}

      {playlist.songs.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          title="No songs in this playlist"
          description="Select songs in your library and choose Add to playlist."
          action={
            <Link to="/" className={buttonVariants({ variant: "outline" })}>
              Open the library
            </Link>
          }
        />
      ) : (
        <ol className="divide-y divide-border rounded-xl border border-border bg-card">
          {playlist.songs.map((song, index) => (
            <li key={song.id} data-testid="playlist-song" className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 text-right text-sm text-muted-foreground tabular-nums">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <Link
                  to="/songs/$songId"
                  params={{ songId: song.id }}
                  data-testid="playlist-song-title"
                  className="block truncate font-medium hover:underline"
                >
                  {song.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {song.trashed ? "In the trash" : song.style}
                </p>
              </div>
              {song.status !== "ready" ? <StatusBadge status={song.status} /> : null}
              {song.status === "ready" && !song.trashed ? (
                <Button size="icon-sm" variant="ghost" aria-label={`Play ${song.title}`} onClick={() => setPlaying(song.id)}>
                  <Play aria-hidden />
                </Button>
              ) : null}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Move up"
                disabled={pending || index === 0}
                onClick={() => void run(() => moveInPlaylist({ data: { playlistId: id, songId: song.id, direction: "up" } }))}
              >
                <ArrowUp aria-hidden />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Move down"
                disabled={pending || index === playlist.songs.length - 1}
                onClick={() => void run(() => moveInPlaylist({ data: { playlistId: id, songId: song.id, direction: "down" } }))}
              >
                <ArrowDown aria-hidden />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Remove"
                disabled={pending}
                onClick={() => void run(() => removeFromPlaylist({ data: { playlistId: id, songId: song.id } }))}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}

      <ShareControl
        shareUrl={playlist.shareUrl}
        onChange={async (on) => {
          await sharePlaylist({ data: { id, on } });
          await router.invalidate();
        }}
      />

      <div className="border-t border-border pt-6">
        <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
          Delete playlist
        </Button>
      </div>

      {editing ? (
        <PlaylistDialog
          title="Edit playlist"
          submitLabel="Save"
          initial={{ name: playlist.name, description: playlist.description }}
          onClose={() => setEditing(false)}
          onSubmit={async (values) => {
            await updatePlaylist({ data: { id, ...values } });
            await router.invalidate();
          }}
        />
      ) : null}
      {deleting ? (
        <ConfirmDialog
          title="Delete this playlist?"
          confirmLabel="Delete playlist"
          destructive
          pending={pending}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            setPending(true);
            try {
              await deletePlaylist({ data: { id } });
              await navigate({ to: "/playlists" });
            } catch (error) {
              toast.error(messageOf(error));
              setPending(false);
              setDeleting(false);
            }
          }}
        >
          The songs stay in your library.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
