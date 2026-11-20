import { createFileRoute, Link, notFound, useNavigate, useRouter } from "@tanstack/react-router";
import { Download, Heart, ListMusic, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AddToPlaylistDialog } from "@/client/components/AddToPlaylistDialog";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { ShareControl } from "@/client/components/ShareControl";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Alert, AlertAction, AlertDescription } from "@/client/components/ui/alert";
import { Button, buttonVariants } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import { messageOf } from "@/client/lib/errors";
import { useRefreshWhile } from "@/client/lib/useRefreshWhile";
import {
  deleteSong,
  getSongPage,
  restoreSong,
  retrySong,
  setLiked,
  shareSong,
  trashSongs,
  updateSong,
  type SongPage as SongPageData,
} from "@/serverFunctions/songs";

export const Route = createFileRoute("/songs/$songId")({
  loader: async ({ params }) => {
    const page = await getSongPage({ data: { id: params.songId } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.song.title ?? "Song not found"} · Song Maker` }],
  }),
  notFoundComponent: () => (
    <AppShell nav={<AppNav />}>
      <EmptyState
        kind="filtered"
        title="Song not found"
        action={
          <Link to="/" className={buttonVariants({ variant: "outline" })}>
            Back to the library
          </Link>
        }
      />
    </AppShell>
  ),
  component: SongPage,
});

function SongPage() {
  const { song, parent, shareUrl } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pending, setPending] = useState(false);
  const inProgress = song.status === "queued" || song.status === "generating";
  useRefreshWhile(inProgress);

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

  const id = song.id;
  const audioUrl = `/api/songs/${id}/audio`;

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title={song.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={song.status} testId="song-status" />
            {song.trashed ? <span>In the trash</span> : null}
            {parent ? (
              <span>
                {song.remixKind === "extend" ? "Extends" : "Cover of"}{" "}
                <Link
                  to="/songs/$songId"
                  params={{ songId: parent.id }}
                  data-testid="parent-link"
                  className="text-foreground underline underline-offset-2"
                >
                  {parent.title}
                </Link>
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={song.liked}
              disabled={pending}
              onClick={() => void run(() => setLiked({ data: { id, liked: !song.liked } }))}
            >
              <Heart aria-hidden className={song.liked ? "fill-current text-primary" : undefined} />
              {song.liked ? "Unlike" : "Like"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </>
        }
      />

      {song.status === "failed" ? (
        <Alert variant="destructive">
          <AlertDescription data-testid="song-error">
            {song.error ?? "Generation failed."}
          </AlertDescription>
          <AlertAction>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => void run(() => retrySong({ data: { id } }))}
            >
              <RotateCcw aria-hidden />
              Retry
            </Button>
          </AlertAction>
        </Alert>
      ) : null}

      {song.status === "ready" ? (
        <div className="space-y-3">
          <audio controls preload="none" src={audioUrl} data-testid="song-audio" className="w-full" />
          <div className="flex flex-wrap gap-2">
            <a href={`${audioUrl}?download=1`} download className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Download aria-hidden />
              Download
            </a>
            <Link
              to="/create"
              search={{ from: id, kind: "cover" }}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Cover
            </Link>
            <Link
              to="/create"
              search={{ from: id, kind: "extend" }}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Extend
            </Link>
            {!song.trashed ? (
              <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
                <ListMusic aria-hidden />
                Add to playlist
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="grid gap-6 sm:grid-cols-[1fr_14rem]">
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Lyrics</h2>
          <p data-testid="song-lyrics" className="text-sm whitespace-pre-wrap text-muted-foreground">
            {song.lyrics || (song.instrumental ? "Instrumental" : song.description)}
          </p>
        </div>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium">Style</dt>
            <dd data-testid="song-style" className="text-muted-foreground">
              {song.style || "—"}
            </dd>
          </div>
          {song.excludeStyles ? (
            <div>
              <dt className="font-medium">Excluded</dt>
              <dd className="text-muted-foreground">{song.excludeStyles}</dd>
            </div>
          ) : null}
          {song.mode === "simple" || song.remixKind === "extend" ? (
            song.description ? (
              <div>
                <dt className="font-medium">{song.mode === "simple" ? "Description" : "Continuation"}</dt>
                <dd className="text-muted-foreground">{song.description}</dd>
              </div>
            ) : null
          ) : null}
          {!song.instrumental && song.vocalGender !== "any" ? (
            <div>
              <dt className="font-medium">Voice</dt>
              <dd className="text-muted-foreground capitalize">{song.vocalGender}</dd>
            </div>
          ) : null}
          {song.durationSec ? (
            <div>
              <dt className="font-medium">Length</dt>
              <dd className="text-muted-foreground">{song.durationSec} seconds</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {!song.trashed ? (
        <ShareControl
          shareUrl={shareUrl}
          onChange={async (on) => {
            await shareSong({ data: { id, on } });
            await router.invalidate();
          }}
        />
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-border pt-6">
        {song.trashed ? (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => void run(() => restoreSong({ data: { id } }))}>
            <RotateCcw aria-hidden />
            Restore
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => void run(() => trashSongs({ data: { ids: [id] } }))}>
            <Trash2 aria-hidden />
            Move to trash
          </Button>
        )}
        <Button variant="destructive" size="sm" onClick={() => setDeleting(true)}>
          Delete forever
        </Button>
      </div>

      {editing ? <EditSongDialog song={song} onClose={() => setEditing(false)} /> : null}
      {adding ? <AddToPlaylistDialog songIds={[id]} onClose={() => setAdding(false)} /> : null}
      {deleting ? (
        <ConfirmDialog
          title="Delete this song forever?"
          confirmLabel="Delete forever"
          destructive
          pending={pending}
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            setPending(true);
            try {
              await deleteSong({ data: { id } });
              await navigate({ to: "/" });
            } catch (error) {
              toast.error(messageOf(error));
              setPending(false);
              setDeleting(false);
            }
          }}
        >
          Its audio and its place in playlists are removed too.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

function EditSongDialog({ song, onClose }: { song: SongPageData["song"]; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(song.title);
  const [lyrics, setLyrics] = useState(song.lyrics);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setError(null);
            try {
              await updateSong({ data: { id: song.id, title, lyrics } });
              await router.invalidate();
              onClose();
            } catch (cause) {
              setError(messageOf(cause));
              setPending(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit song</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input id="edit-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-lyrics">Lyrics</Label>
            <Textarea id="edit-lyrics" value={lyrics} onChange={(event) => setLyrics(event.target.value)} rows={10} maxLength={5000} />
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" pending={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
