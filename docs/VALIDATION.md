# Validation boundaries

## Native highest-tier follow-up, 2026-10-26

In the existing verified Codex session, the original complete scene ran at 1920x1320 with a 30 FPS capture cap and JPEG quality 92, without restarting Codex or changing desktop engine settings. Native fonts/date/time and effects were visible; a quiet, owned four-second system-audio fixture produced the original circular bars. No user-player queue or playback controls were invoked. This accepts one scene's native route, not universal wallpaper parity.

The short accepted sample produced 27.07 canvas updates per second and a sampled capture-callback-to-draw P95 of 90.76ms. The callback begins after the native source has produced a frame, and canvas draw is earlier than physical screen presentation. These are proxy measurements, not source Present FPS, full audio-to-display latency or physical display latency. Source-frame timing and user visual comparison remain separate.

A malformed candidate JPEG was rejected while retaining the previous renderer object and layer. A second real Codex window with an injected 500ms draw delay updated at 3.49 FPS while the main window retained 27.77 FPS. The temporary delay was removed and the saved focus preference retained. Source encoding of the same locally sampled frame fell from roughly 18ms to 6ms by passing contiguous BGRA instead of a strided three-channel view, with identical JPEG bytes.

Resource evidence includes the complete Codex/engine/helper process group and per-process GPU engine counters. It includes the pre-existing desktop Wallpaper Engine scenes and ordinary Codex workloads, so its approximately 4 GiB summed working set and short roughly 18% machine CPU sample must not be described as the wallpaper's incremental cost. Shared pages, GPU memory and workload variation prevent that inference. GPU engine counters are reported separately rather than added into one GPU percentage.

The maintenance tool completed a seven-entry/nine-file private-library roundtrip into a separate directory, refused an existing destination, and supports offline native/WebGL reference relocation. A focused fixture additionally checks corrupted assets, traversal and Windows short-path canonicalization. No backup files are distributed.

The earlier statements below retain historical acceptance boundaries. Taskbar visual grouping, a new machine/client-version matrix, source-native mouse forwarding, exact physical latency and arbitrary-script parity remain unaccepted. Startup animation and WebGL Web loading remain deferred.

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

Resource follow-up: 34 unit tests pass, including capture ownership across windows, focus debounce, stale startup cancellation, complete media clearing and preset failure restoration. Isolated UI conversion confirms the power button saves 960/12 FPS plus pause-on-blur and produces actual 12 FPS video without duplicate copies. Isolated WebGL tests exercise event-driven pause/resume and retain media delivery for scenes without audio processing. Installed Codex accepted video mode with zero captured frames, no closed-panel refreshes, fresh properties on panel reopen, audio startup for an original generated Scene, zero continuing frequency deliveries while paused, restart on resume and restoration to the original video/settings. The GUI browser instance remained unchanged. These checks establish the lifecycle policy; they do not establish a universal CPU/GPU saving percentage or exact performance for arbitrary Workshop scenes.

Embedded-browser input regression: the isolated integration reproduces a transparent main pane intercepting input above a body-portaled guest with the former root z-index, then verifies routed mouse clicks and wheel scrolling after restoring the root's native stacking level. In installed Codex, three points previously hit the transparent pane and subsequently hit the visible native browser guest. The same browser tab, wallpaper and settings were preserved without a client restart. Direct guest scrolling alone is not evidence that physical pointer input can reach that guest.

## Fixed-duration native stability and source failure

The single 905.84-second actual-Codex run averaged 27.30 canvas updates per second with sampled callback-to-draw P95 88.81ms. All 181 samples retained advancing frames without target errors. Heap-used first/middle/last-minute medians were approximately 10.5/10.4/11.1 MiB; RSS varied and its endpoint rose, so no indefinite leak-free claim is made. Temporary focus-pause overrides were restored. This finite diagnostic does not install a resident monitor.

Closing only the unique project-owned source window triggered automatic return to the previous video. Native state cleared and the owned Python capture processes exited. The original Codex process and start time remained unchanged. The full native scene was subsequently restored. Real normal-exit/cold-start, taskbar visual grouping, system sleep/wake and physical screen/audio latency remain separate acceptance items.

Final edge-case review preserved native aspect/JPEG quality during manual FPS edits and quarantined timed-out renderer targets. An actual 1900ms target-delay check sent exactly two remote draws before quarantine, left the main window at 28.04 updates/second, and recovered on explicit reapplication. These late failure-path changes received focused verification; the 15-minute run is evidence for the preceding common rendering path, not a second full-duration run of every final edge case.
