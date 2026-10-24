# Validation boundaries

The realtime scene/web feature has local native capture and canvas-playback evidence for one installed scene, with offscreen capture, profile switching and restoration to the original media background. Measured output remains below some requested FPS caps; see [REALTIME.md](REALTIME.md). This does not prove general GPU performance, every wallpaper or fresh-machine startup. A generated animated Web wallpaper was also captured natively with changing frames and source cleanup. WebGL Scene has separate native sample acceptance; see [WEBWALLGL.md](WEBWALLGL.md).

The development implementation was visually checked in the official Windows Codex client version `26.1016.8622.0` for wallpaper rendering, in-app management, settings styling, separate composer space and hot 12/24 FPS application. Those private screenshots/logs are intentionally not distributed.

This portable source candidate changes dependency discovery and storage locations. Its clean-room synthetic/unit checks do not prove every official client version or startup path works. Full cold startup, taskbar pin replacement/grouping, and a fresh-machine install remain manual release gates. Startup animation is out of scope.

Checks available in this candidate:

| Check | What it establishes | What it does not establish |
| --- | --- | --- |
| `npm test` | Fresh empty settings, bounded folder discovery, token/path handling, managed deletion and source safeguards using synthetic files | Native client behavior |
| `npm run check:privacy` | Expected files only, content patterns, manifest hashes and no bundled media/profile/binaries | Absence of every possible sensitive string in future changes or Git history |
| `npm run test:integration` | Isolated Chromium UI and generated media, local conversion/hot application, embedded panel resizing/persistence, presets, rotation, effects, paged filtering and empty-library cleanup | Login, real client permissions, cold startup or taskbar integration |
| PowerShell parse / launcher compile | Script syntax and C# compilation | Working native client launch |

Before a public release, a maintainer should use a disposable profile and original test media on a fresh Windows installation, test ordinary exit/start, focus pause, settings navigation, narrow windows and multiline/attachment composer sizes. Preserve drafts and never force-close a live user's client for acceptance tests.

Do not replace this status with an unqualified “all supported” claim merely because tests are green.

Follow-up checks: 24 unit tests; isolated UI import tests include duplicate upload/folder reminders, checked-item partial-success batches and explicit preview/apply. Installed Codex accepted thumbnail preview, visible renderer inspection, two-item batch saving, repeat-batch duplicate summaries, duplicate modal and deletion with the prior wallpaper retained. Real nonzero system spectrum changed a generated Scene and its zero-state restored. Player-control acceptance is partial due to Windows current-session changes; see SYSTEM-MEDIA.md.
