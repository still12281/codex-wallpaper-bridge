# Privacy

## What the repository contains

Source code, newly written documentation, synthetic test generators, minimal licensed third-party source, and an empty example configuration. It does not include real account profiles, cookies, tokens, chat transcripts, screenshots, personal wallpaper selections, imported wallpaper files, shortcut files, binaries, or machine-specific Git history.

The public host does **not** automatically take screenshots of the desktop or chats. Opt-in realtime wallpapers capture only their uniquely named Wallpaper Engine render window after confirmation and pass JPEG frames in memory; frames are not saved or uploaded. Preparation used an explicit file allowlist, not a copy of the development runtime directory.

## Local runtime data

By default all generated data is under `%LOCALAPPDATA%\CodexWallpaperBridge`, outside the checkout. `CODEX_WALLPAPER_DATA_DIR` may override it with an absolute path. Do not point this setting inside a repository you intend to publish.

This data can contain:

- Wallpaper source paths, titles, Workshop IDs, search locations and choices in `settings.json`.
- Imported/extracted source copies and converted media under `media` and `staging`.
- The debugging profile, with any data stored by the official client in that profile. Treat it as sensitive account data.
- Local process, CDP browser/target identifiers and diagnostic errors in status/log files.
- A launcher sidecar containing the source checkout path, and a locally extracted app icon.

No telemetry or upload service is implemented by this project's host. Its CDP connection is restricted to `127.0.0.1`; folder discovery and media processing run locally. The official Codex client has its own network/account behavior, outside this project's control. Wallpaper links and upstream URLs in documentation are not fetched by the wallpaper runtime.

## Sharing reports

Do not attach an entire data directory, browser profile, real settings file, or raw debugging dump to an issue. Redact personal names, paths, titles, media and any conversation/account information from screenshots and logs. Prefer a newly generated sample video and a minimal description of client/OS/dependency versions.

`npm run check:privacy` checks the release allowlist, content patterns and hashes. It is a guard against common mistakes, not proof that arbitrary future edits contain no private information. Review the actual files and Git history again before publishing.
