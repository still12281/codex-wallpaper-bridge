# Validation boundaries

The realtime scene/web feature is implemented but has not undergone native capture, occlusion, performance or cleanup acceptance. The user explicitly owns those manual checks; see [REALTIME.md](REALTIME.md). Syntax and dependency loading are separate from those acceptance results. Earlier integration assertions expecting unsupported scenes to fail must be updated for the new confirmation flow before treating them as realtime coverage.

The development implementation was visually checked in the official Windows Codex client version `26.1016.8622.0` for wallpaper rendering, in-app management, settings styling, separate composer space and hot 12/24 FPS application. Those private screenshots/logs are intentionally not distributed.

This portable source candidate changes dependency discovery and storage locations. Its clean-room synthetic/unit checks do not prove every official client version or startup path works. Full cold startup, taskbar pin replacement/grouping, and a fresh-machine install remain manual release gates. Startup animation is out of scope.

Checks available in this candidate:

| Check | What it establishes | What it does not establish |
| --- | --- | --- |
| `npm test` | Fresh empty settings, bounded folder discovery, token/path handling, managed deletion and source safeguards using synthetic files | Native client behavior |
| `npm run check:privacy` | Expected files only, content patterns, manifest hashes and no bundled media/profile/binaries | Absence of every possible sensitive string in future changes or Git history |
| `npm run test:integration` | Isolated Chromium UI and generated media, local conversion/hot application and empty-library behavior | Login, real client permissions, cold startup or taskbar integration |
| PowerShell parse / launcher compile | Script syntax and C# compilation | Working native client launch |

Before a public release, a maintainer should use a disposable profile and original test media on a fresh Windows installation, test ordinary exit/start, focus pause, settings navigation, narrow windows and multiline/attachment composer sizes. Preserve drafts and never force-close a live user's client for acceptance tests.

Do not replace this status with an unqualified “all supported” claim merely because tests are green.
