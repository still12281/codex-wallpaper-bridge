# Feature migration status

Current follow-up: [4K, DSH source reuse, resource and flashing evidence](USABILITY-20261026.md). Earlier measurements below retain their original scope and do not describe the new 4K profile.

Baseline: DSH Wallpaper Engine v1.4.0 at `3b0103bc1d5431840208966ce67155f392c4095c`. The Codex bridge keeps its own host, local settings, launcher and native surface mappings.

| Feature | Implementation | Acceptance |
| --- | --- | --- |
| Scene rendering | Optional WebWallGL 3.0.0, package and loose-directory broker, bounded viewport, scripts, pointer, pause/disposal | Synthetic tests and two native Scene probes; see WEBWALLGL.md |
| Web rendering | Existing Wallpaper Engine native capture | Generated native Web animation: 21 changing capture frames / 1.6s; WebWallGL Web channel remains pending |
| Library | Unmodified upstream picker model; 24-item pages, type/rating filters, bounded previews, batch hide/restore and checked-item batch save | Synthetic and installed Codex preview/inspection, checked batch save, duplicate dialogs and deletion passed; hides never delete source projects |
| Rotation | Host-owned scheduler for saved media/GPU/native references, logical grouping, bad-item skip, selection tickets, sequential/shuffle and background waiting | Actual isolated host GPU cycle/cleanup and manual-over-auto priority passed; native-engine rotation remains unaccepted |
| Appearance presets | Codex-specific versioned JSON whitelist, local save/apply/delete/import/export; transactional rollback | Unit and UI roundtrip passed; no paths/media/account data exported |
| Glass/fonts | Existing Codex selectors plus blur/opacity, local font families and sizes | Synthetic style application and installed settings-panel visual review |
| FX | Unmodified upstream click/trail renderer with a small shared-scope adapter and native accent mapping | Synthetic create/remove checks; reduced motion and background behavior honored |
| Background parallax | Codex-specific bounded pointer mapping with time-smoothing and idle stop | Synthetic input and transform checked |
| Playback | Flip, video speed, muted-by-default WebGL scene volume, first-frame fade-in | Lightweight video copies have no audio track; native capture has no audio transport; volume is enabled only for WebGL |
| System music | Optional pinned media-bridge adapter, metadata/control capabilities and spectrum channel | Real nonzero WASAPI-to-Scene pixels and zero restoration passed; OS fixture controls passed, complete current-player controls partially failed on Windows session switching; identity guard added |
| Panel sizing | Embedded resize grip, keyboard sizing, persisted size and reset | Synthetic and installed Codex mouse drag, reopen persistence and reset accepted; no independent window |
| Author properties and fonts | Pinned DSH property model, typed per-wallpaper values/reset/hot update; exact WebWallGL 3.0.0 in-memory FontFace binary adapter | Actual Codex hidden candidates accepted properties and loaded text pixels under unchanged CSP; visible effects, shared fonts and full component parity remain pending |
| Frame caps and output | GPU 12/24/30/60/120/144 independent of media/native caps; exact 4K/R=1; renderer/decoder/canvas metrics | Isolated actual AMD submissions and 4K readback passed; physical display rate and native-client high-refresh acceptance remain pending |
| DSH pet choreography | Excluded by user | No pet work in this follow-up; character assets are not copied |
| Startup animation | Upstream first-frame fade and switch transitions inspected | See STARTUP-EFFECTS.md; no branded intro installed |
| Highest native scene tier | Confirmed full native project, window-proportional size, desktop FPS cap, JPEG quality 92 and bounded per-window delivery | Actual Codex scene, font/time and original audio bars; short timing and failure/slow-window evidence; physical display latency and general parity remain unaccepted |
| Library maintenance | Private settings and owned-media backup, hash-checked restore to empty directory, project-reference diagnosis/relocation | Local roundtrip; no external assets deleted or copied into Git |

This is a feature migration, not a DSH client rebuild. The new controls use the existing Codex settings panel. The optional engine is prepared in private runtime data; no wallpaper images, character packages, font files or native helper binaries are added to Git.
