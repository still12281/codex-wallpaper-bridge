# Privacy

## What the repository contains

Source code, newly written documentation, synthetic test generators, minimal licensed third-party source, an empty example configuration, and individually reviewed documentation PNGs listed in [the capture index](docs/SCREENSHOTS.zh-CN.md). It does not include real account profiles, cookies, tokens, raw chat transcripts, real configuration files, imported wallpaper files, shortcut files or executable binaries. Development notes and Git history retain bounded implementation and validation facts; they require review before publication and are not a dump of the private runtime directory.

The documentation captures were explicitly requested and taken from the actual desktop client on an empty, unsubmitted new-chat screen. Private fields were temporarily hidden before capture. Only app/panel regions were captured, without the desktop or taskbar. Gallery thumbnails are self-made examples; no demo projects were imported into the private library. Third-party wallpaper visible in the overview remains its author's work. No general screenshot permission is added to the runtime. Release validation permits only exact reviewed filenames, checks raw-byte hashes and rejects PNG metadata or appended content; visual review is still required.

The public host does **not** automatically take screenshots of the desktop or chats. Opt-in realtime wallpapers capture only their uniquely named Wallpaper Engine render window after confirmation and pass JPEG frames in memory; frames are not saved or uploaded. Preparation used an explicit file allowlist, not a copy of the development runtime directory.

## Local runtime data

Bridge-managed settings, media copies, installed versions, diagnostics and helper caches live under `%LOCALAPPDATA%\CodexWallpaperBridge` by default, outside the checkout. `CODEX_WALLPAPER_DATA_DIR` may override it with an absolute path. Do not point this setting inside a repository you intend to publish.

The official client uses its own existing account profile; the unified entry does not create or move that profile. GPU resource CacheStorage lives in that official profile and is not included in a bridge data-directory backup. The optional Chromium Web renderer uses separate, private dedicated browser-profile slots under `web-runtime` in the bridge data directory; stopping the browser does not delete those directories. Legacy dedicated Codex profiles, if present from an older installation, are retained rather than migrated or deleted. See [local maintenance](docs/MAINTENANCE.zh-CN.md) before backing up, clearing caches or uninstalling.

This data can contain:

- Wallpaper source paths, titles, Workshop IDs, search locations and choices in `settings.json`.
- Imported/extracted source copies and converted media under `media` and `staging`.
- Legacy dedicated debugging profiles retained from older installations, or the separate Chromium Web source profile. Treat any profile containing account data as sensitive; do not include it in reports.
- Local process, CDP browser/target identifiers and diagnostic errors in status/log files.
- A launcher sidecar containing the source checkout path, and a locally extracted app icon.

No telemetry or upload service is implemented by this project's host. Its CDP connection is restricted to `127.0.0.1`; folder discovery and media processing run locally. The official Codex client has its own network/account behavior, outside this project's control. Wallpaper links and upstream URLs in documentation are not fetched by the wallpaper runtime.

## Sharing reports

Do not attach an entire data directory, browser profile, real settings file, or raw debugging dump to an issue. Redact personal names, paths, titles, media and any conversation/account information from screenshots and logs. Prefer a newly generated sample video and a minimal description of client/OS/dependency versions.

`npm run check:privacy` checks the release allowlist, content patterns and hashes. It is a guard against common mistakes, not proof that arbitrary future edits contain no private information. Review the actual files and Git history again before publishing.

## Optional system media

System media and loopback spectrum are disabled by default. When enabled, a separate local helper reads Windows playback metadata and optional system output spectrum over stdio. No continuous audio is saved or uploaded by the host. The helper may cache metadata/artwork under the private data root; online lyrics lookup is disabled. Wallpaper scenes receive bounded text metadata and fresh spectrum values, not account/player handles. See [SYSTEM-MEDIA.md](docs/SYSTEM-MEDIA.md) for the exact network and acceptance scope. Panel size and position are saved in the local client profile.
