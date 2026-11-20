import { createFileRoute } from "@tanstack/react-router";
import { audioResponse } from "@/server/audio";
import { sharedPlaylistAudio } from "@/server/share";

// Public (everyapp.config.ts): the nth ready song of a shared playlist.
export const Route = createFileRoute("/s/audio/list/$token/$n")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const n = /^\d{1,4}$/.test(params.n) ? Number(params.n) : 0;
        const found = n ? await sharedPlaylistAudio(params.token, n) : null;
        if (!found) return new Response("Not found", { status: 404 });
        return audioResponse(found.object, found.title, false);
      },
    },
  },
});
