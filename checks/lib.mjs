// A local stand-in for a Gateway that holds a music-generation key. It
// answers the integration status as ready and returns a few bytes of audio
// for each generation call, or a refusal when the prompt asks for one.
export const AUDIO_BYTES = "ID3\u0003fake-mp3-frames";

const FAKE_GATEWAY = `
const calls = [];
export default { async fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === "/__calls") return Response.json(calls);
  if (request.method === "GET" && url.pathname === "/api/integrations/elevenlabs") {
    return Response.json({ requested: true, configured: true, ready: true, settings: [], setup: null, command: null });
  }
  if (url.pathname.startsWith("/api/integrations/elevenlabs/api.elevenlabs.io/")) {
    const body = await request.text();
    calls.push({ path: url.pathname, body });
    if (body.includes("NO-GO")) {
      return Response.json({ detail: { status: "bad_prompt", message: "The prompt was refused." } }, { status: 422 });
    }
    return new Response(${JSON.stringify(AUDIO_BYTES)}, { headers: { "content-type": "audio/mpeg" } });
  }
  return Response.json({ error: "Not found", code: "not_found" }, { status: 404 });
} };`;

export const withGeneration = {
  bindings: { EVERY_APP_GATEWAY: { type: "worker", worker: "fake-gateway" } },
  workers: [{
    config: {
      name: "fake-gateway",
      compatibilityDate: "2025-01-01",
      manifest: { mainModule: "gateway.mjs", modules: { "gateway.mjs": { type: "esm", contents: FAKE_GATEWAY } } },
    },
  }],
};

export async function generationCalls(runtime) {
  const worker = await runtime.mf.getWorker("fake-gateway");
  return (await worker.fetch("http://gateway/__calls")).json();
}

/** Fills the custom form and submits it; resolves on the new song's page. */
export async function createCustomSong(page, song) {
  await page.goto("/create");
  await page.getByRole("tab", { name: "Custom" }).click();
  await page.getByLabel("Title").fill(song.title);
  await page.getByLabel("Lyrics").fill(song.lyrics);
  await page.getByLabel("Styles", { exact: true }).fill(song.style);
  if (song.exclude) await page.getByLabel("Exclude styles").fill(song.exclude);
  if (song.length) await page.getByLabel("Length").fill(String(song.length));
  await Promise.all([
    page.waitForURL(/\/songs\/[^/]+$/),
    page.getByRole("button", { name: "Create song" }).click(),
  ]);
  return page.url().split("/songs/")[1];
}

export async function waitForStatus(page, status) {
  await page.getByTestId("song-status").filter({ hasText: status }).waitFor({ timeout: 30_000 });
}
