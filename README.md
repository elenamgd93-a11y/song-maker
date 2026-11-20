# Song Maker

Make songs from a short description or from your own lyrics and styles, then keep them in a private library, sort them into playlists and share any of them by link.

Inspired by https://suno.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Create a song from a description, or in custom mode with a title, lyrics, styles, excluded styles, voice, instrumental and length.
- Browse, search and filter your own songs, play and download them, edit, like, trash, restore or delete them.
- Remix one of your songs as a cover in a new style, or extend it with more lyrics.
- Build playlists, add songs in bulk, reorder them and play them through.
- Turn a share link on or off for a song or a playlist, for anyone to listen read-only.

Left out: the studio editor and section tools, voices and custom models, stem separation, the community feed and profiles, credits and plans, starting from uploaded audio, mobile apps, and accounts and sign-in, which your Gateway handles.

## Setup

- Install: `pnpm install`. Run locally: `pnpm dev`. Test: `pnpm test` and `pnpm types:check`; the release checks are in `checks/`.
- Deploy: `pnpm run deploy`, then `pnpm everyapp configure song-maker`.
- Song generation (optional): an ElevenLabs API key held by your Gateway (`everyapp provider add elevenlabs`; key from https://elevenlabs.io/app/settings/api-keys). Without it, the library, playlists and share links work and creating is off.
- No other secrets or settings. Songs live in D1, audio in R2, and generation runs on a Cloudflare Queue.

## Limitations

- Generation cost and limits are your ElevenLabs account's.
- An extend is a new song written to follow the original; it does not continue the original audio.
- A real generation call and a real deploy were not exercised by the local checks, which use a stand-in for the music service.
