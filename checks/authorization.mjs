// Who may reach what: private pages, other members' songs and playlists,
// share links for anyone, admin-only setup help, and no sign-in of its own (X001).
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { createCustomSong, waitForStatus, withGeneration } from "./lib.mjs";

const runtime = await startRuntime(withGeneration);
try {
  await runtime.assertPrivateAccess(["/", "/create", "/playlists"]);

  // The owner's song and playlist.
  const owner = await (await runtime.context("owner")).newPage();
  const ownerSong = await createCustomSong(owner, {
    title: "Lighthouse Keeper",
    lyrics: "[Verse]\nI keep the light for ships I never meet",
    style: "dark folk, cello",
  });
  await waitForStatus(owner, "Ready");
  await owner.goto("/playlists");
  await owner.getByRole("button", { name: "New playlist" }).click();
  await owner.getByLabel("Name").fill("Night Shift");
  await Promise.all([owner.waitForURL(/\/playlists\/[^/]+$/), owner.getByRole("button", { name: "Create" }).click()]);
  const ownerPlaylist = owner.url().split("/playlists/")[1];

  const db = await runtime.database();
  const ownerRow = async () => db.prepare("SELECT title, lyrics, liked, trashed_at, share_token FROM songs WHERE id = ?").bind(ownerSong).first();
  const original = await ownerRow();
  expect(original.title).toBe("Lighthouse Keeper");

  // Anonymous and outsiders get nothing private, including audio.
  for (const role of [undefined, "outsider"]) {
    expect([401, 403]).toContain((await runtime.fetch(`/api/songs/${ownerSong}/audio`, { role })).status);
    expect([401, 403]).toContain((await runtime.fetch(`/songs/${ownerSong}`, { role })).status);
    expect([401, 403]).toContain((await runtime.fetch(`/playlists/${ownerPlaylist}`, { role })).status);
  }

  // Another member can't see the owner's song, playlist or audio.
  const member = await (await runtime.context("member")).newPage();
  await member.goto("/");
  await expect(member.getByText("Lighthouse Keeper")).toHaveCount(0);
  await member.goto(`/songs/${ownerSong}`);
  await expect(member.getByText("Song not found")).toBeVisible();
  await expect(member.getByText("I keep the light")).toHaveCount(0);
  await member.goto(`/playlists/${ownerPlaylist}`);
  await expect(member.getByText("Playlist not found")).toBeVisible();
  await expect(member.getByText("Night Shift")).toHaveCount(0);
  await member.goto("/playlists");
  await expect(member.getByText("Night Shift")).toHaveCount(0);
  expect((await runtime.fetch(`/api/songs/${ownerSong}/audio`, { role: "member" })).status).toBe(404);
  await member.goto(`/create?from=${ownerSong}&kind=cover`);
  await expect(member.getByText("Song not found")).toBeVisible();

  // ... nor change them, even by rewriting its own requests.
  const memberSong = await createCustomSong(member, {
    title: "Night Bus",
    lyrics: "[Verse]\nRiding home on the night bus",
    style: "lo-fi hip hop",
  });
  await waitForStatus(member, "Ready");
  // Opens the member's own song, then sends one action with the owner's id swapped in.
  const swap = (page, from, to) => page.route("**/_serverFn/**", async (route) => {
    const body = route.request().postData();
    await route.continue(body ? { postData: body.replaceAll(from, to) } : {});
  });
  const serverCall = (page) => page.waitForResponse((response) => response.url().includes("/_serverFn/") && response.request().method() === "POST");
  const tampered = async (action) => {
    await member.goto(`/songs/${memberSong}`);
    await swap(member, memberSong, ownerSong);
    await action();
    await member.unroute("**/_serverFn/**");
  };
  await tampered(() => Promise.all([serverCall(member), member.getByRole("button", { name: "Like" }).click()]));
  await tampered(() => Promise.all([serverCall(member), member.getByRole("switch", { name: "Share link" }).click()]));
  await tampered(async () => {
    await member.getByRole("button", { name: "Edit" }).click();
    await member.getByLabel("Title").fill("Taken over");
    await Promise.all([serverCall(member), member.getByRole("button", { name: "Save" }).click()]);
  });
  await tampered(() => Promise.all([serverCall(member), member.getByRole("button", { name: "Move to trash" }).click()]));
  await tampered(async () => {
    await member.getByRole("button", { name: "Delete forever" }).click();
    await Promise.all([serverCall(member), member.getByRole("alertdialog").getByRole("button", { name: "Delete forever" }).click()]);
  });
  expect(await ownerRow()).toEqual(original);
  // A remix of someone else's song is refused.
  await member.goto(`/songs/${memberSong}`);
  await Promise.all([member.waitForURL(/\/create\?/), member.getByRole("link", { name: "Cover" }).click()]);
  await swap(member, memberSong, ownerSong);
  await member.getByRole("button", { name: "Create song" }).click();
  await expect(member.getByRole("alert").filter({ hasText: "Song not found" })).toBeVisible();
  await member.unroute("**/_serverFn/**");
  const remixes = await db.prepare("SELECT count(*) AS n FROM songs WHERE parent_song_id = ?").bind(ownerSong).first();
  expect(remixes.n).toBe(0);

  // The member's own song can't go into the owner's playlist.
  await member.goto("/playlists");
  await member.getByRole("button", { name: "New playlist" }).click();
  await member.getByLabel("Name").fill("Mine");
  await Promise.all([member.waitForURL(/\/playlists\/[^/]+$/), member.getByRole("button", { name: "Create" }).click()]);
  const memberPlaylist = member.url().split("/playlists/")[1];
  await member.goto("/");
  await member.getByRole("checkbox", { name: "Select Night Bus" }).click();
  await member.getByRole("button", { name: "Add to playlist" }).click();
  await swap(member, memberPlaylist, ownerPlaylist);
  await Promise.all([serverCall(member), member.getByRole("button", { name: "Mine" }).click()]);
  await member.unroute("**/_serverFn/**");
  const inOwnerList = await db.prepare("SELECT count(*) AS n FROM playlist_songs WHERE playlist_id = ?").bind(ownerPlaylist).first();
  expect(inOwnerList.n).toBe(0);
  // Nor can the owner's song go into the member's playlist.
  await owner.goto("/");
  await owner.getByRole("checkbox", { name: "Select Lighthouse Keeper" }).click();
  await owner.getByRole("button", { name: "Add to playlist" }).click();
  await swap(owner, ownerPlaylist, memberPlaylist);
  await Promise.all([serverCall(owner), owner.getByRole("button", { name: "Night Shift" }).click()]);
  await owner.unroute("**/_serverFn/**");
  const inMemberList = await db.prepare("SELECT count(*) AS n FROM playlist_songs WHERE playlist_id = ?").bind(memberPlaylist).first();
  expect(inMemberList.n).toBe(0);

  // Share links: only an active token works, and the page shows the song and nothing about its owner.
  expect((await runtime.fetch("/s/song/not-a-real-token")).status).toBe(404);
  expect((await runtime.fetch(`/s/song/${ownerSong}`)).status).toBe(404);
  await owner.goto(`/songs/${ownerSong}`);
  await owner.getByRole("switch", { name: "Share link" }).click();
  const link = new URL(await owner.getByTestId("share-url").inputValue()).pathname;
  const shared = await runtime.fetch(link);
  expect(shared.status).toBe(200);
  const html = await shared.text();
  expect(html).toContain("Lighthouse Keeper");
  expect(html).not.toContain("owner@example.test");
  expect(html).not.toContain(ownerSong);
  const token = link.split("/").pop();
  expect((await runtime.fetch(`/s/audio/list/${token}/${ownerSong}`)).status).toBe(404);
  // A shared page offers no editing to a visitor.
  const visitor = await (await runtime.context(null)).newPage();
  await visitor.goto(link);
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText("Lighthouse Keeper");
  await expect(visitor.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(visitor.getByRole("button", { name: "Move to trash" })).toHaveCount(0);
  // A playlist's link shows only its ready songs and their audio.
  await owner.goto(`/playlists/${ownerPlaylist}`);
  await owner.getByRole("switch", { name: "Share link" }).click();
  const listLink = new URL(await owner.getByTestId("share-url").inputValue()).pathname;
  const listToken = listLink.split("/").pop();
  expect((await runtime.fetch(listLink)).status).toBe(200);
  expect((await runtime.fetch(`/s/audio/list/${listToken}/${memberSong}`)).status).toBe(404);
  expect((await runtime.fetch(`/s/audio/list/${listToken}/${ownerSong}`)).status).toBe(404);

  // Admin-only: setup help names the command for admins only.
  {
    const off = await startRuntime();
    try {
      const admin = await (await off.context("owner")).newPage();
      await admin.goto("/create");
      await expect(admin.getByTestId("generation-off")).toContainText("everyapp provider add elevenlabs");
      const plain = await (await off.context("member")).newPage();
      await plain.goto("/create");
      await expect(plain.getByTestId("generation-off")).toContainText("Ask an admin");
      await expect(plain.getByTestId("generation-off")).not.toContainText("everyapp provider add");
    } finally {
      await off.close();
    }
  }

  // X001: the app has no sign-in of its own.
  for (const path of ["/login", "/signin", "/signup", "/register", "/logout"]) {
    const response = await runtime.fetch(path, { role: "member" });
    expect(response.status).toBe(404);
    expect(await response.text()).not.toMatch(/type="password"/);
  }
} finally {
  await runtime.close();
}
console.log("authorization: ok");
