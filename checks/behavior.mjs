// The main path of every feature: create (F001), library and player (F002),
// remix (F003), playlists (F004) and share links (F005).
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { AUDIO_BYTES, createCustomSong, generationCalls, waitForStatus, withGeneration } from "./lib.mjs";

// Without a music-generation key, creating is unavailable and says what to set up.
{
  const runtime = await startRuntime();
  try {
    const page = await (await runtime.context("owner")).newPage();
    await page.goto("/create");
    await expect(page.getByTestId("generation-off")).toContainText("ElevenLabs");
    await expect(page.getByRole("button", { name: "Create song" })).toHaveCount(0);
  } finally {
    await runtime.close();
  }
}

const runtime = await startRuntime(withGeneration);
try {
  const page = await (await runtime.context("owner")).newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  await runtime.assertBackLink(page);

  // F001: from a description, instrumental, with a title made from it.
  await page.goto("/create");
  await page.getByLabel("Description").fill("a warm lo-fi beat for slow rainy mornings in the city");
  await page.getByRole("switch", { name: "Instrumental" }).click();
  await Promise.all([
    page.waitForURL(/\/songs\/[^/]+$/),
    page.getByRole("button", { name: "Create song" }).click(),
  ]);
  await waitForStatus(page, "Ready");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("A warm lo-fi beat");
  await expect(page.getByTestId("song-audio")).toHaveAttribute("src", /\/api\/songs\/.+\/audio/);
  let calls = await generationCalls(runtime);
  expect(calls.length).toBe(1);
  expect(JSON.parse(calls[0].body).force_instrumental).toBe(true);

  // F001: custom mode with lyrics, styles, exclusions, voice and length.
  await page.goto("/create");
  await page.getByRole("tab", { name: "Custom" }).click();
  await page.getByLabel("Title").fill("Harbor Lights");
  await page.getByLabel("Lyrics").fill("[Verse]\nThe boats come home when the evening falls\nLanterns swinging on the harbor walls\n\n[Chorus]\nHold on, hold on, the tide is turning\nHarbor lights are burning");
  await page.getByLabel("Styles", { exact: true }).fill("indie folk, acoustic guitar");
  await page.getByLabel("Exclude styles").fill("heavy drums");
  await page.getByRole("combobox", { name: "Voice" }).click();
  await page.getByRole("option", { name: "Female" }).click();
  await page.getByLabel("Length").fill("90");
  await Promise.all([
    page.waitForURL(/\/songs\/[^/]+$/),
    page.getByRole("button", { name: "Create song" }).click(),
  ]);
  const harborId = page.url().split("/songs/")[1];
  await waitForStatus(page, "Ready");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Harbor Lights");
  await expect(page.getByTestId("song-style")).toContainText("indie folk, acoustic guitar");
  await expect(page.getByTestId("song-lyrics")).toContainText("Lanterns swinging on the harbor walls");
  calls = await generationCalls(runtime);
  const custom = calls.at(-1).body;
  expect(custom).toContain("heavy drums");
  expect(custom).toContain("Lanterns swinging on the harbor walls");
  expect(custom).toContain("female");

  // F002: download is the stored audio.
  const download = page.getByRole("link", { name: "Download" });
  const href = await download.getAttribute("href");
  const file = await runtime.fetch(href, { role: "owner" });
  expect(file.status).toBe(200);
  expect(file.headers.get("content-disposition")).toContain("attachment");
  expect(await file.text()).toBe(AUDIO_BYTES);

  // F001: a failed generation shows its reason and can be retried.
  const failedId = await createCustomSong(page, { title: "Static Hum", lyrics: "Nothing left to say", style: "NO-GO noise" });
  await waitForStatus(page, "Failed");
  await expect(page.getByTestId("song-error")).toContainText("The prompt was refused.");
  const before = (await generationCalls(runtime)).length;
  await page.getByRole("button", { name: "Retry" }).click();
  await expect.poll(async () => (await generationCalls(runtime)).length, { timeout: 30_000 }).toBe(before + 1);
  await waitForStatus(page, "Failed");

  // F002: edit the title and lyrics, like the song.
  await page.goto(`/songs/${harborId}`);
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Title").fill("Harbor Lights at Dawn");
  await page.getByLabel("Lyrics").fill("[Verse]\nThe boats come home when the morning calls\nLanterns swinging on the harbor walls\n\n[Chorus]\nHold on, hold on, the tide is turning\nHarbor lights are burning");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Harbor Lights at Dawn");
  await expect(page.getByTestId("song-lyrics")).toContainText("when the morning calls");
  await page.getByRole("button", { name: "Like" }).click();
  await expect(page.getByRole("button", { name: "Unlike" })).toBeVisible();

  // F003: a cover keeps the lyrics and takes a new style, and links back.
  await Promise.all([page.waitForURL(/\/create\?/), page.getByRole("link", { name: "Cover" }).click()]);
  await expect(page.getByLabel("Lyrics")).toHaveValue(/when the morning calls/);
  await page.getByLabel("Styles", { exact: true }).fill("synthwave, dreamy pads");
  await Promise.all([
    page.waitForURL(/\/songs\/[^/]+$/),
    page.getByRole("button", { name: "Create song" }).click(),
  ]);
  await waitForStatus(page, "Ready");
  await expect(page.getByTestId("parent-link")).toHaveAttribute("href", `/songs/${harborId}`);
  await expect(page.getByTestId("parent-link")).toContainText("Harbor Lights at Dawn");
  await expect(page.getByTestId("song-style")).toContainText("synthwave");

  // F003: an extend continues with new lyrics.
  await page.goto(`/songs/${harborId}`);
  await Promise.all([page.waitForURL(/\/create\?/), page.getByRole("link", { name: "Extend" }).click()]);
  await page.getByLabel("Lyrics").fill("[Bridge]\nWhen the fog lifts off the bay\nWe will find our way");
  await Promise.all([
    page.waitForURL(/\/songs\/[^/]+$/),
    page.getByRole("button", { name: "Create song" }).click(),
  ]);
  await waitForStatus(page, "Ready");
  await expect(page.getByTestId("parent-link")).toHaveAttribute("href", `/songs/${harborId}`);
  expect((await generationCalls(runtime)).at(-1).body).toContain("When the fog lifts off the bay");

  // F002: newest first, search, filters.
  await page.goto("/");
  const rows = page.getByTestId("song-row");
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText("Harbor Lights at Dawn (Extended)");
  await page.getByLabel("Search songs").fill("fog lifts");
  await expect(rows).toHaveCount(1);
  await page.getByLabel("Search songs").fill("synthwave");
  await expect(rows).toHaveCount(1);
  await page.getByLabel("Search songs").fill("");
  await expect(rows).toHaveCount(5);
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Failed" }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Static Hum");
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Any status" }).click();
  await page.getByRole("button", { name: "Liked", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Harbor Lights at Dawn");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(rows).toHaveCount(5);

  // F004: a playlist, filled in bulk from the library.
  await page.goto("/playlists");
  await page.getByRole("button", { name: "New playlist" }).click();
  await page.getByLabel("Name").fill("Coastal Evenings");
  await page.getByLabel("Description").fill("Slow songs for the drive home along the coast");
  await Promise.all([page.waitForURL(/\/playlists\/[^/]+$/), page.getByRole("button", { name: "Create" }).click()]);
  const playlistUrl = new URL(page.url()).pathname;
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Select Harbor Lights at Dawn", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select A warm lo-fi beat", exact: false }).click();
  await page.getByRole("button", { name: "Add to playlist" }).click();
  await page.getByRole("button", { name: "Coastal Evenings" }).click();
  await expect(page.getByText("Added 2 songs to Coastal Evenings")).toBeVisible();
  // Adding the same songs again adds nothing twice.
  await page.getByRole("checkbox", { name: "Select Harbor Lights at Dawn", exact: true }).click();
  await page.getByRole("button", { name: "Add to playlist" }).click();
  await page.getByRole("button", { name: "Coastal Evenings" }).click();
  await expect(page.getByText("Already in Coastal Evenings")).toBeVisible();

  await page.goto(playlistUrl);
  const items = page.getByTestId("playlist-song");
  await expect(items).toHaveCount(2);
  const firstTitle = (await items.first().getByTestId("playlist-song-title").textContent()).trim();
  await items.first().getByRole("button", { name: "Move down" }).click();
  await expect(items.nth(1).getByTestId("playlist-song-title")).toHaveText(firstTitle);
  await page.getByRole("button", { name: "Play all" }).click();
  await expect(page.getByTestId("playlist-audio")).toHaveAttribute("src", /\/api\/songs\/.+\/audio/);
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Name").fill("Coastal Evenings Mix");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Coastal Evenings Mix");

  // F005: a song's share link, on, off and on again.
  await page.goto(`/songs/${harborId}`);
  await page.getByRole("switch", { name: "Share link" }).click();
  const shareUrl = page.getByTestId("share-url");
  await expect(shareUrl).toHaveValue(new RegExp(`^https?://${runtime.hostname.replaceAll(".", "\\.")}(:\\d+)?/s/song/`));
  const firstLink = await shareUrl.inputValue();
  const anonymous = await (await runtime.context(null)).newPage();
  await anonymous.goto(firstLink);
  await expect(anonymous.getByRole("heading", { level: 1 })).toHaveText("Harbor Lights at Dawn");
  await expect(anonymous.getByTestId("song-lyrics")).toContainText("Lanterns swinging");
  await expect(anonymous.getByTestId("song-style")).toContainText("indie folk");
  const publicAudio = await anonymous.getByTestId("song-audio").getAttribute("src");
  expect(await (await runtime.fetch(publicAudio)).text()).toBe(AUDIO_BYTES);
  await page.getByRole("switch", { name: "Share link" }).click();
  await expect(shareUrl).toHaveCount(0);
  expect((await runtime.fetch(new URL(firstLink).pathname)).status).toBe(404);
  expect((await runtime.fetch(publicAudio)).status).toBe(404);
  await page.getByRole("switch", { name: "Share link" }).click();
  await expect(shareUrl).toHaveValue(/\/s\/song\//);
  const secondLink = await shareUrl.inputValue();
  expect(secondLink).not.toBe(firstLink);
  expect((await runtime.fetch(new URL(secondLink).pathname)).status).toBe(200);
  expect((await runtime.fetch(new URL(firstLink).pathname)).status).toBe(404);

  // F005: a playlist's share link shows its ready songs.
  await page.goto(playlistUrl);
  await page.getByRole("switch", { name: "Share link" }).click();
  const listLink = await page.getByTestId("share-url").inputValue();
  await anonymous.goto(listLink);
  await expect(anonymous.getByRole("heading", { level: 1 })).toHaveText("Coastal Evenings Mix");
  await expect(anonymous.getByTestId("playlist-song")).toHaveCount(2);
  await expect(anonymous.getByText("Harbor Lights at Dawn")).toBeVisible();

  // F002: trash, restore, bulk trash and delete forever.
  await page.goto(`/songs/${failedId}`);
  await page.getByRole("button", { name: "Move to trash" }).click();
  await expect(page.getByRole("button", { name: "Restore" })).toBeVisible();
  await page.goto("/");
  await expect(rows).toHaveCount(4);
  await page.getByRole("button", { name: "Trash", exact: true }).click();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Static Hum");
  await page.goto(`/songs/${failedId}`);
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("button", { name: "Move to trash" })).toBeVisible();
  await page.goto("/");
  await page.getByRole("checkbox", { name: "Select Static Hum" }).click();
  await page.getByRole("button", { name: "Move to trash" }).click();
  await expect(rows).toHaveCount(4);
  await page.goto(`/songs/${failedId}`);
  await page.getByRole("button", { name: "Delete forever" }).click();
  await Promise.all([page.waitForURL(/\/$|\/\?/), page.getByRole("alertdialog").getByRole("button", { name: "Delete forever" }).click()]);
  await page.goto(`/songs/${failedId}`);
  await expect(page.getByText("Song not found")).toBeVisible();

  // F004: removing a song from a playlist, then deleting the playlist, keeps the songs.
  await page.goto(playlistUrl);
  await items.first().getByRole("button", { name: "Remove" }).click();
  await expect(items).toHaveCount(1);
  await page.getByRole("button", { name: "Delete playlist" }).click();
  await Promise.all([page.waitForURL(/\/playlists$/), page.getByRole("alertdialog").getByRole("button", { name: "Delete playlist" }).click()]);
  await expect(page.getByText("Coastal Evenings Mix")).toHaveCount(0);

  // One more song, so the library looks lived in.
  await createCustomSong(page, {
    title: "Paper Kites",
    lyrics: "[Verse]\nWe drew the sky on paper kites\nAnd let them run through summer nights",
    style: "bright pop, ukulele, hand claps",
  });
  await waitForStatus(page, "Ready");
  await page.goto("/");
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText("Paper Kites");

  // Phone-sized smoke.
  const phone = await (await runtime.context("owner", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/");
  await expect(phone.getByRole("heading", { name: "Library" })).toBeVisible();
  await expect(phone.getByTestId("song-row").first()).toBeVisible();
  await phone.goto(`/songs/${harborId}`);
  await expect(phone.getByRole("heading", { level: 1 })).toHaveText("Harbor Lights at Dawn");

  await runtime.screenshot(page);
} finally {
  await runtime.close();
}
console.log("behavior: ok");
