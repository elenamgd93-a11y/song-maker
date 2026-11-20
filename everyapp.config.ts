import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "song-maker",
  name: "Song Maker",
  description:
    "Make songs from a description or your own lyrics, keep them in a library and playlists, and share them by link.",
  icon: "/icon.svg",
  resources: {
    d1: ["DB"],
    // The generated audio files.
    r2: ["files"],
    // Generation runs here, after the page has answered.
    queues: [{ name: "SONG_JOBS", consumer: { maxBatchSize: 1, maxRetries: 2 } }],
  },
  capabilities: {
    elevenlabs: {
      access: "read",
      why: "Generates each song's audio from its description, lyrics and styles.",
      docs: "https://elevenlabs.io/app/settings/api-keys",
    },
  },
  features: {
    generation: {
      name: "Song generation",
      why: "Creates new songs and remixes.",
      capabilities: ["elevenlabs"],
    },
  },
  // Share links, opened by anyone who has one: the page, its audio, and the
  // files the page loads. Each checks its token (src/server/share.ts).
  public: [{ path: "/s/**", methods: ["GET"] }],
  publicAssets: ["/assets/**", "/icon.svg"],
});
