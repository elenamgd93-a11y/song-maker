import { createFileRoute } from "@tanstack/react-router";
import { audioResponse } from "@/server/audio";
import { sharedSongAudio } from "@/server/share";

// Public (everyapp.config.ts): a shared song's audio, while its link is on.
export const Route = createFileRoute("/s/audio/song/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const found = await sharedSongAudio(params.token);
        if (!found) return new Response("Not found", { status: 404 });
        return audioResponse(found.object, found.title, false);
      },
    },
  },
});
