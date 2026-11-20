import { createFileRoute, notFound } from "@tanstack/react-router";
import { LinkNotFound } from "@/client/components/LinkNotFound";
import { PageHeader } from "@/client/components/PageHeader";
import { PublicShell } from "@/client/components/PublicShell";
import { getSharedSong } from "@/serverFunctions/shared";

// Public (everyapp.config.ts): a song's share link, read-only.
export const Route = createFileRoute("/s/song/$token")({
  loader: async ({ params }) => {
    const song = await getSharedSong({ data: { token: params.token } });
    if (!song) throw notFound();
    return song;
  },
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.title ?? "Song Maker" }] }),
  notFoundComponent: LinkNotFound,
  component: SharedSong,
});

function SharedSong() {
  const song = Route.useLoaderData();
  const { token } = Route.useParams();
  return (
    <PublicShell>
      <PageHeader title={song.title} description={<span data-testid="song-style">{song.style}</span>} />
      {song.playable ? (
        <audio controls preload="none" src={`/s/audio/song/${token}`} data-testid="song-audio" className="w-full" />
      ) : (
        <p className="text-sm text-muted-foreground">This song isn't ready to play yet.</p>
      )}
      {song.lyrics ? (
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Lyrics</h2>
          <p data-testid="song-lyrics" className="text-sm whitespace-pre-wrap text-muted-foreground">
            {song.lyrics}
          </p>
        </section>
      ) : null}
    </PublicShell>
  );
}
