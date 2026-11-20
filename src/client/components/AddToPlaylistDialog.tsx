import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Spinner } from "@/client/components/ui/spinner";
import { messageOf } from "@/client/lib/errors";
import {
  addSongsToPlaylist,
  createPlaylist,
  getPlaylists,
} from "@/serverFunctions/playlists";

type Playlist = Awaited<ReturnType<typeof getPlaylists>>[number];

/** Picks a playlist (or makes one) and adds the songs to it. */
export function AddToPlaylistDialog({
  songIds,
  onClose,
  onAdded,
}: {
  songIds: string[];
  onClose: () => void;
  onAdded?: () => void;
}) {
  const [playlists, setPlaylists] = useState<Playlist[] | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getPlaylists()
      .then(setPlaylists)
      .catch((error: unknown) => toast.error(messageOf(error)));
  }, []);

  async function add(playlistId: string) {
    setPending(true);
    try {
      const { added, name: listName } = await addSongsToPlaylist({
        data: { playlistId, songIds },
      });
      if (added === 0) toast(`Already in ${listName}`);
      else toast.success(`Added ${added} ${added === 1 ? "song" : "songs"} to ${listName}`);
      onAdded?.();
      onClose();
    } catch (error) {
      toast.error(messageOf(error));
      setPending(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to playlist</DialogTitle>
        </DialogHeader>
        {playlists === null ? (
          <Spinner />
        ) : (
          <div className="flex flex-col gap-1">
            {playlists.map((playlist) => (
              <Button
                key={playlist.id}
                variant="ghost"
                className="justify-between"
                disabled={pending}
                onClick={() => void add(playlist.id)}
              >
                <span className="truncate">{playlist.name}</span>
                <span className="text-xs text-muted-foreground" aria-hidden>
                  {playlist.songCount}
                </span>
              </Button>
            ))}
          </div>
        )}
        <form
          className="flex gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) return;
            setPending(true);
            try {
              const { id } = await createPlaylist({ data: { name, description: "" } });
              await add(id);
            } catch (error) {
              toast.error(messageOf(error));
              setPending(false);
            }
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New playlist"
            aria-label="New playlist name"
          />
          <Button type="submit" variant="outline" disabled={pending || !name.trim()}>
            Create and add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
