import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/** Each member the app has seen, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const songs = sqliteTable(
  "songs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    orgId: text("org_id").notNull(),
    title: text("title").notNull(),
    mode: text("mode", { enum: ["simple", "custom"] }).notNull(),
    description: text("description").notNull().default(""),
    lyrics: text("lyrics").notNull().default(""),
    style: text("style").notNull().default(""),
    excludeStyles: text("exclude_styles").notNull().default(""),
    vocalGender: text("vocal_gender", { enum: ["any", "male", "female"] })
      .notNull()
      .default("any"),
    instrumental: integer("instrumental", { mode: "boolean" })
      .notNull()
      .default(false),
    durationSec: integer("duration_sec"),
    parentSongId: text("parent_song_id"),
    remixKind: text("remix_kind", { enum: ["cover", "extend"] }),
    status: text("status", {
      enum: ["queued", "generating", "ready", "failed"],
    }).notNull(),
    error: text("error"),
    audioKey: text("audio_key"),
    liked: integer("liked", { mode: "boolean" }).notNull().default(false),
    trashedAt: integer("trashed_at"),
    shareToken: text("share_token").unique(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("songs_owner_created").on(table.ownerId, table.createdAt)],
);

export const playlists = sqliteTable(
  "playlists",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    shareToken: text("share_token").unique(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("playlists_owner").on(table.ownerId)],
);

export const playlistSongs = sqliteTable(
  "playlist_songs",
  {
    playlistId: text("playlist_id").notNull(),
    songId: text("song_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.playlistId, table.songId] }),
    index("playlist_songs_song").on(table.songId),
  ],
);
