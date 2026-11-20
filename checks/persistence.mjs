// Songs, their audio, likes, playlists and share links survive a restart.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { AUDIO_BYTES, createCustomSong, waitForStatus, withGeneration } from "./lib.mjs";

const runtime = await startRuntime(withGeneration);
try {
  let page = await (await runtime.context("owner")).newPage();
  const songId = await createCustomSong(page, {
    title: "Orchard Road",
    lyrics: "[Verse]\nApples falling down the orchard road",
    style: "country, pedal steel",
  });
  await waitForStatus(page, "Ready");
  await page.getByRole("button", { name: "Like" }).click();
  await expect(page.getByRole("button", { name: "Unlike" })).toBeVisible();
  await page.getByRole("switch", { name: "Share link" }).click();
  const shareLink = new URL(await page.getByTestId("share-url").inputValue()).pathname;
  await page.goto("/playlists");
  await page.getByRole("button", { name: "New playlist" }).click();
  await page.getByLabel("Name").fill("Harvest");
  await Promise.all([page.waitForURL(/\/playlists\/[^/]+$/), page.getByRole("button", { name: "Create" }).click()]);
  const playlistPath = new URL(page.url()).pathname;
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Select Orchard Road" }).click();
  await page.getByRole("button", { name: "Add to playlist" }).click();
  await page.getByRole("button", { name: "Harvest" }).click();
  await expect(page.getByText("Added 1 song to Harvest")).toBeVisible();

  await runtime.restart();

  page = await (await runtime.context("owner")).newPage();
  await page.goto(`/songs/${songId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Orchard Road");
  await expect(page.getByTestId("song-status")).toHaveText("Ready");
  await expect(page.getByTestId("song-lyrics")).toContainText("Apples falling");
  await expect(page.getByRole("button", { name: "Unlike" })).toBeVisible();
  const audio = await runtime.fetch(`/api/songs/${songId}/audio`, { role: "owner" });
  expect(audio.status).toBe(200);
  expect(await audio.text()).toBe(AUDIO_BYTES);
  await page.goto(playlistPath);
  await expect(page.getByTestId("playlist-song")).toHaveCount(1);
  await expect(page.getByTestId("playlist-song")).toContainText("Orchard Road");
  expect((await runtime.fetch(shareLink)).status).toBe(200);
} finally {
  await runtime.close();
}
console.log("persistence: ok");
