CREATE TABLE `playlist_songs` (
	`playlist_id` text NOT NULL,
	`song_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`playlist_id`, `song_id`)
);
--> statement-breakpoint
CREATE INDEX `playlist_songs_song` ON `playlist_songs` (`song_id`);--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`share_token` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlists_share_token_unique` ON `playlists` (`share_token`);--> statement-breakpoint
CREATE INDEX `playlists_owner` ON `playlists` (`owner_id`);--> statement-breakpoint
CREATE TABLE `songs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`org_id` text NOT NULL,
	`title` text NOT NULL,
	`mode` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`lyrics` text DEFAULT '' NOT NULL,
	`style` text DEFAULT '' NOT NULL,
	`exclude_styles` text DEFAULT '' NOT NULL,
	`vocal_gender` text DEFAULT 'any' NOT NULL,
	`instrumental` integer DEFAULT false NOT NULL,
	`duration_sec` integer,
	`parent_song_id` text,
	`remix_kind` text,
	`status` text NOT NULL,
	`error` text,
	`audio_key` text,
	`liked` integer DEFAULT false NOT NULL,
	`trashed_at` integer,
	`share_token` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `songs_share_token_unique` ON `songs` (`share_token`);--> statement-breakpoint
CREATE INDEX `songs_owner_created` ON `songs` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
