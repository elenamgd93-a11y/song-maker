import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ListMusic, Plus } from "lucide-react";
import { useState } from "react";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { PlaylistDialog } from "@/client/components/PlaylistDialog";
import { Button } from "@/client/components/ui/button";
import { createPlaylist, getPlaylists } from "@/serverFunctions/playlists";

export const Route = createFileRoute("/playlists/")({
  loader: () => getPlaylists(),
  head: () => ({ meta: [{ title: "Playlists · Song Maker" }] }),
  component: Playlists,
});

function Playlists() {
  const playlists = Route.useLoaderData();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Playlists"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden />
            New playlist
          </Button>
        }
      />
      {playlists.length === 0 ? (
        <EmptyState icon={ListMusic} title="No playlists yet" description="Make one, then add songs from your library." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {playlists.map((playlist) => (
            <li key={playlist.id}>
              <Link
                to="/playlists/$playlistId"
                params={{ playlistId: playlist.id }}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{playlist.name}</span>
                  {playlist.description ? (
                    <span className="block truncate text-sm text-muted-foreground">{playlist.description}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {playlist.songCount} {playlist.songCount === 1 ? "song" : "songs"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {creating ? (
        <PlaylistDialog
          title="New playlist"
          submitLabel="Create"
          onClose={() => setCreating(false)}
          onSubmit={async (values) => {
            const { id } = await createPlaylist({ data: values });
            await navigate({ to: "/playlists/$playlistId", params: { playlistId: id } });
          }}
        />
      ) : null}
    </AppShell>
  );
}
