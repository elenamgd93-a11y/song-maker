import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Heart, ListMusic, Music, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { AddToPlaylistDialog } from "@/client/components/AddToPlaylistDialog";
import { AppNav } from "@/client/components/AppNav";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { SegmentedToggle } from "@/client/components/SegmentedToggle";
import { StatusBadge } from "@/client/components/StatusBadge";
import { Button, buttonVariants } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { messageOf } from "@/client/lib/errors";
import { useRefreshWhile } from "@/client/lib/useRefreshWhile";
import { getLibrary, trashSongs } from "@/serverFunctions/songs";

const search = z.object({
  q: z.string().optional().catch(undefined),
  status: z.enum(["queued", "generating", "ready", "failed"]).optional().catch(undefined),
  view: z.enum(["all", "liked", "trash"]).optional().catch(undefined),
});

export const Route = createFileRoute("/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getLibrary({ data: { q: deps.q || undefined, status: deps.status, view: deps.view ?? "all" } }),
  head: () => ({ meta: [{ title: "Library · Song Maker" }] }),
  component: Library,
});

const STATUS_ITEMS = [
  { value: "any", label: "Any status" },
  { value: "queued", label: "Queued" },
  { value: "generating", label: "Generating" },
  { value: "ready", label: "Ready" },
  { value: "failed", label: "Failed" },
] as const;

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function Library() {
  const songs = Route.useLoaderData();
  const params = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const router = useRouter();
  const [query, setQuery] = useState(params.q ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const view = params.view ?? "all";
  const filtered = Boolean(params.q || params.status || view !== "all");

  useRefreshWhile(songs.some((song) => song.status === "queued" || song.status === "generating"));

  useEffect(() => {
    const visible = new Set(songs.map((song) => song.id));
    setSelected((current) => current.filter((id) => visible.has(id)));
  }, [songs]);

  useEffect(() => {
    if ((params.q ?? "") === query) return;
    const timer = setTimeout(() => {
      void navigate({ search: (prev) => ({ ...prev, q: query || undefined }), replace: true });
    }, 200);
    return () => clearTimeout(timer);
  }, [query, params.q, navigate]);

  async function trashSelected() {
    try {
      const moved = await trashSongs({ data: { ids: selected } });
      toast.success(`Moved ${moved} ${moved === 1 ? "song" : "songs"} to the trash`);
      setSelected([]);
      await router.invalidate();
    } catch (error) {
      toast.error(messageOf(error));
    }
  }

  const allSelected = songs.length > 0 && selected.length === songs.length;

  return (
    <AppShell nav={<AppNav />}>
      <PageHeader
        title="Library"
        actions={
          <Link to="/create" className={buttonVariants()}>
            <Music aria-hidden />
            Create
          </Link>
        }
      />
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, lyrics or style"
            aria-label="Search songs"
            className="min-w-48 flex-1 bg-card"
          />
          <Select
            value={params.status ?? "any"}
            onValueChange={(value) =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  status: value === "any" || value === null ? undefined : (value as typeof params.status),
                }),
              })
            }
            items={STATUS_ITEMS}
          >
            <SelectTrigger aria-label="Status" className="w-36 bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <SegmentedToggle
            showLabels
            value={view}
            onChange={(next) =>
              void navigate({ search: (prev) => ({ ...prev, view: next === "all" ? undefined : next }) })
            }
            items={[
              { value: "all", label: "All", icon: <ListMusic aria-hidden /> },
              { value: "liked", label: "Liked", icon: <Heart aria-hidden /> },
              { value: "trash", label: "Trash", icon: <Trash2 aria-hidden /> },
            ]}
          />
        </div>

        {selected.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
            <span className="mr-auto">{selected.length} selected</span>
            {view !== "trash" ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                  <ListMusic aria-hidden />
                  Add to playlist
                </Button>
                <Button size="sm" variant="outline" onClick={() => void trashSelected()}>
                  <Trash2 aria-hidden />
                  Move to trash
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        ) : null}

        {songs.length === 0 ? (
          filtered ? (
            <EmptyState kind="filtered" title="No songs match" />
          ) : (
            <EmptyState
              media="rows"
              icon={Music}
              title="No songs yet"
              description="Songs you create appear here."
              action={
                <Link to="/create" className={buttonVariants()}>
                  Create a song
                </Link>
              }
            />
          )
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all"
                      checked={allSelected}
                      onCheckedChange={(checked) => setSelected(checked ? songs.map((song) => song.id) : [])}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {songs.map((song) => (
                  <TableRow key={song.id} data-testid="song-row">
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${song.title}`}
                        checked={selected.includes(song.id)}
                        onCheckedChange={(checked) =>
                          setSelected((current) =>
                            checked ? [...current, song.id] : current.filter((id) => id !== song.id),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="max-w-0 w-full">
                      <Link
                        to="/songs/$songId"
                        params={{ songId: song.id }}
                        className="flex items-center gap-1.5 font-medium hover:underline"
                      >
                        <span className="truncate">{song.title}</span>
                        {song.liked ? <Heart className="size-3.5 shrink-0 fill-current text-primary" aria-label="Liked" /> : null}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {song.style || song.description || (song.instrumental ? "Instrumental" : "")}
                      </p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={song.status} />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground sm:table-cell">
                      {dateFormat.format(song.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      {adding ? (
        <AddToPlaylistDialog
          songIds={selected}
          onClose={() => setAdding(false)}
          onAdded={() => setSelected([])}
        />
      ) : null}
    </AppShell>
  );
}
