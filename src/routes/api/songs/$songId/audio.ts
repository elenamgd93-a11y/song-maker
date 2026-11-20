import { createFileRoute } from "@tanstack/react-router";
import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { audioResponse } from "@/server/audio";
import { songAudio } from "@/server/songs";

// The owner's audio: played on the song page, or downloaded with ?download=1.
export const Route = createFileRoute("/api/songs/$songId/audio")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await getEveryAppUser(request, env);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const found = await songAudio(user.id, params.songId);
        if (!found) return new Response("Not found", { status: 404 });
        const download = new URL(request.url).searchParams.has("download");
        return audioResponse(found.object, found.title, download);
      },
    },
  },
});
