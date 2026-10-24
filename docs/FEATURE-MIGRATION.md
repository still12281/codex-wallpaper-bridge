# Feature migration status

Baseline: DSH Wallpaper Engine v1.4.0 at `3b0103bc1d5431840208966ce67155f392c4095c`. The Codex bridge keeps its own host, local settings, launcher and native surface mappings.

| Feature | Implementation | Acceptance |
| --- | --- | --- |
| Scene rendering | Optional WebWallGL 3.0.0, package and loose-directory broker, bounded viewport, scripts, pointer, pause/disposal | Synthetic tests and two native Scene probes; see WEBWALLGL.md |
| Web rendering | Existing Wallpaper Engine native capture | WebWallGL resource/script channel still pending |
| Library | Unmodified upstream picker model; 24-item pages, type/rating filters, bounded preview cache, batch hide/restore | Synthetic UI flow passed; hides never delete source projects |
| Rotation | Host-owned scheduler, imported image/video lists, sequential/shuffle, exclude hidden/current, defer while background | Synthetic automatic rotation and background deferral passed |
| Appearance presets | Codex-specific versioned JSON whitelist, local save/apply/delete/import/export; transactional rollback | Unit and UI roundtrip passed; no paths/media/account data exported |
| Glass/fonts | Existing Codex selectors plus blur/opacity, local font families and sizes | Synthetic style application; full native visual review pending deployment |
| FX | Unmodified upstream click/trail renderer with a small shared-scope adapter and native accent mapping | Synthetic create/remove checks; reduced motion and background behavior honored |
| Background parallax | Codex-specific bounded pointer mapping with time-smoothing and idle stop | Synthetic input and transform checked |
| Playback | Flip, video speed, muted-by-default media/WebGL volume, first-frame fade-in | Native capture has no audio transport and disables its volume control |
| System music | Optional external media-bridge protocol/license verified | Runtime adapter and native run still pending |
| DSH pet choreography | No equivalent public Codex pet pose/lease/position/playback API | Cannot claim an equivalent official-pet port; character assets are not copied |

This is a feature migration, not a DSH client rebuild. The new controls use the existing Codex settings panel. The optional engine is prepared in private runtime data; no wallpaper images, character packages, font files or native helper binaries are added to Git.
