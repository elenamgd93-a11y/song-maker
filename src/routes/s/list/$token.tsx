import { createFileRoute, notFound } from "@tanstack/react-router";
import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { LinkNotFound } from "@/client/components/LinkNotFound";
import { PageHeader } from "@/client/components/PageHeader";
import { PublicShell } from "@/client/components/PublicShell";
import { Button } from "@/client/components/ui/button";
import { getSharedPlaylist } from "@/serverFunctions/shared";

// Public (everyapp.config.ts): a playlist's share link, its ready songs only.
export const Route = createFileRoute("/s/list/$token")({
  loader: async ({ params }) => {
    const playlist = await getSharedPlaylist({ data: { token: params.token } });
    if (!playlist) throw notFound();
    return playlist;
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.name ?? "Song Maker" }] }),
  notFoundComponent: LinkNotFound,
  component: SharedPlaylist,
});

function SharedPlaylist() {
  const playlist = Route.useLoaderData();
  const { token } = Route.useParams();
  const [playing, setPlaying] = useState<number | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (playing) void audio.current?.play().catch(() => undefined);
  }, [playing]);
  const current = playlist.songs.find((song) => song.n === playing);

  return (
    <PublicShell>
      <PageHeader
        title={playlist.name}
        description={playlist.description || null}
        actions={
          playlist.songs.length > 0 ? (
            <Button size="sm" onClick={() => setPlaying(1)}>
              <Play aria-hidden />
              Play all
            </Button>
          ) : null
        }
      />
      {current ? (
        <div className="space-y-1 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">{current.title}</p>
          <audio
            ref={audio}
            controls
            src={`/s/audio/list/${token}/${current.n}`}
            onEnded={() => setPlaying(playlist.songs.find((song) => song.n === current.n + 1)?.n ?? null)}
            className="w-full"
          />
        </div>
      ) : null}
      {playlist.songs.length === 0 ? (
        <EmptyState title="No songs to play yet" />
      ) : (
        <ol className="divide-y divide-border rounded-xl border border-border bg-card">
          {playlist.songs.map((song) => (
            <li key={song.n} data-testid="playlist-song" className="flex items-center gap-3 px-3 py-2">
              <span className="w-6 text-right text-sm text-muted-foreground tabular-nums">{song.n}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{song.title}</p>
                <p className="truncate text-xs text-muted-foreground">{song.style}</p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={`Play ${song.title}`} onClick={() => setPlaying(song.n)}>
                <Play aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}
    </PublicShell>
  );
}
