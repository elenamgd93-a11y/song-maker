import tanstackEntry from "@tanstack/react-start/server-entry";
import { everyApp } from "@every-app/sdk/server";
import { runSongJob } from "@/server/generate";

// everyApp() verifies the identity the Gateway sent before any request reaches
// the app (a request from anywhere else is a 401).
const app = everyApp<Env>(async (request) => tanstackEntry.fetch(request));

export default {
  fetch: app.fetch,
  // SONG_JOBS: each message is one song to generate (src/server/generate.ts).
  async queue(batch: MessageBatch<{ songId: string }>) {
    for (const message of batch.messages) {
      try {
        await runSongJob(message.body.songId);
        message.ack();
      } catch (error) {
        console.error("Song job failed", error);
        message.retry();
      }
    }
  },
};
