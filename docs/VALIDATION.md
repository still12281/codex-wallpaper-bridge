# Validation record

## Status recorded on 2026-11-07

| Area | Environment | Result |
| --- | --- | --- |
| Wallpaper control entry after native menu class change | Installed Codex 26.1103.3517.0 | Restored after Help in the native menu row; actual button has a 48×28 bounding box and passes the page hit test. The existing wallpaper layer, renderer object, client process and saved configuration are retained. |
| Control entry and interaction regression | Isolated Chrome, generated shell | Passed: both known class formats, native-menu semantics after a class rename, visible fallback, pointer opening, appearance action roundtrip, closing, late/replaced menus, and preserved background/draft. |

The previous control host was connected but had `display:none` because its menu selector required `_ApplicationMenuTopBar_`, while the installed shell uses `ApplicationMenuTopBar-…`. Wallpaper readiness alone did not expose this missing entry. Runtime records now include control-entry visibility and placement separately.

## Status recorded on 2026-11-06

| Area | Environment | Result |
| --- | --- | --- |
| Unit checks | GitHub Actions, Windows, Node 22 and 24 | 88 checks passed |
| Installer, process identity, startup and update policy | Windows, PowerShell 7 and generated child processes | Passed; includes duplicate events, close-once handling, timeout, PID reuse, path loss and configuration preservation |
| Normal exit followed immediately by one taskbar-entry click | Installed Codex 26.1103.3517.0 | Passed: the entry waited for the previous root to exit, then restored main and detached wallpapers |
| Close the window to tray, then reopen through the same taskbar entry | Installed Codex 26.1103.3517.0 | Passed: 0.874 seconds in the activation record; user confirmed immediate display, working clicks and scrolling; original client process and saved settings retained |
| Native window binding and activation transport | Hidden Win32 fixture windows and a generated CDP peer | Passed: role-cookie reuse, target replacement, foreign/destroyed windows, bridge payload, hidden-view failure and browser-identity checks |
| Startup page replacement, early colors and wallpaper handoff | Isolated Chrome with generated pages and an SVG wallpaper | Passed: new-page palette applied in 47.7 ms, subsequent document palette preceded parser JavaScript, native animation retained, real wallpaper adopted, unrelated page unchanged |
| Late native theme initialization | Isolated Chrome, generated native-shell structure | Passed: text color, theme-guard settling, snapshot restoration and wallpaper continuity |
| WebGL browser-disconnect cleanup | Isolated Chrome and a generated scene | Passed: host exited in 97.4 ms |
| Repaired automatic recovery during a new Microsoft Store package update | Installed Codex | Not run |
| Fresh-machine installation and cross-DPI taskbar grouping | Fresh Windows installation / multiple DPI settings | Not run |

The recorded normal-exit launch reported host readiness at 10.34 seconds and launcher confirmation at 11.71 seconds, measured from helper-process creation. These are host/status milestones. Chat UI readiness and physical screen presentation were not sampled in that run.

Source and installation assets for [alpha.4](https://github.com/still12281/codex-wallpaper-bridge/releases/tag/v0.1.0-alpha.4) passed Windows Node 22/24 CI, four-asset readback hashes, and the public download/ZIP verification/extraction/installer `-CheckOnly` path. The check reported no missing dependencies and `willStartClient=false`.

## Repeatable checks

| Command or check | Environment and assertions |
| --- | --- |
| `npm test` | Generated files: empty settings, bounded discovery, tokens, paths, deletion ownership and source checks |
| `npm run check:privacy` | Release file allowlist, content patterns, source hashes and reviewed image hashes |
| `npm run test:integration` | Isolated Chromium and generated media: import, conversion, hot application, resizing, presets, rotation, effects and empty-library cleanup |
| `node test/startup-transition-integration.mjs` | Generated page replacement, document-start palette, native animation, wallpaper handoff and unrelated-page checks |
| `node test/startup-priority-integration.mjs --scenario early-shell` | Early real-image paint, late shell/menu creation, native theme initialization and restoration |
| `node test/startup-priority-integration.mjs --webgl-exit-only` | Generated WebGL startup and browser-disconnect cleanup |
| `test/update-reconnect.ps1` and `test/update-runner.ps1` | Event filtering, close-once decisions, full generated runner, duplicate-event consumption and saved-settings preservation |

Manual validation on a fresh Windows installation uses original test media and a disposable profile: install, normal exit/start, focus pause, settings navigation, narrow windows, attachment/multiline composer sizing and taskbar grouping. Save drafts and use normal client exit during these checks.

## Historical native rendering measurements, 2026-10-23 through 2026-10-26

The installed Codex 26.1016.8622.0 session was checked for rendering, management, settings styling, composer space, thumbnails, two-item batch saving, duplicate summaries, deletion and hot 12/24 FPS application. Native WebGL checks rendered two locally owned Scene packages, changing pixels, pause/resume and cleanup. [WebGL details](WEBWALLGL.md) and [media-control coverage](SYSTEM-MEDIA.md) list the individual cases.

One original complete scene ran through WGC and Codex canvas at 1920×1320, a 30 FPS capture cap and JPEG quality 92. Fonts, date/time and effects were visible. An owned four-second system-audio fixture drove the original circular bars; the user's player queue and controls were unchanged. The short sample measured 27.07 canvas updates/s and capture-callback-to-draw P95 90.76 ms. The callback starts after source-frame production; draw completion precedes physical presentation.

A malformed JPEG retained the previous renderer and layer. A detached window with an injected 500 ms draw delay updated at 3.49 FPS while the main window retained 27.77 FPS; the delay was then removed. Encoding the same sampled source frame with contiguous BGRA reduced approximately 18 ms to 6 ms and produced identical JPEG bytes.

The resource sample included the complete Codex/engine/helper group, the existing desktop Wallpaper Engine scenes and ordinary Codex workloads: approximately 4 GiB summed working set and roughly 18% machine CPU during the short sample. It did not isolate incremental wallpaper cost. Per-engine GPU counters were recorded separately.

The backup tool completed a seven-entry/nine-file roundtrip into a separate directory, rejected an existing destination and relocated native/WebGL references. Generated checks covered corrupted assets, traversal and Windows short-path canonicalization.

A generated animated Web wallpaper produced changing native-capture frames and released its source. The separate Chromium Web source received headless pipe and lifecycle checks on 2026-10-27, when the installed 26.1023 client had no wallpaper CDP listener. Visible adoption of that source in Codex was not run in that session; [manual recovery](AFTER-UPDATE-RECONNECT.zh-CN.md) records the later successful client launch.

Lifecycle checks covered shared capture ownership, focus debounce, cancellation, media clearing and preset restoration. The power preset generated 960-pixel/12 FPS video. Installed checks covered zero capture in video mode, closed-panel inactivity, property refresh, audio response, paused frequency delivery, resume and return to the saved video/settings.

The embedded-browser regression reproduced a transparent main pane intercepting clicks and wheel input in an isolated browser, then verified native stacking. Installed-client hit testing changed three sampled points from that pane to the visible guest, with the same tab, wallpaper and settings.

## Fixed-duration native stability and source failure

A 905.84-second installed-Codex run averaged 27.30 canvas updates/s and callback-to-draw P95 88.81 ms. All 181 samples retained advancing frames and no target errors. Heap-used first/middle/last-minute medians were 10.5/10.4/11.1 MiB; RSS varied and ended higher. Focus-pause overrides were restored after the run.

Closing the project-owned source window returned to the previous video, cleared native state and released the owned Python capture processes. Codex retained its process identity and the full native scene was subsequently restored.

A later injected 1900 ms target delay sent exactly two draws before quarantine, retained 28.04 updates/s on the main window and recovered on explicit reapplication. This focused check followed the 905.84-second common-rendering run.
