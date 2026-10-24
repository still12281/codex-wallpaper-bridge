# Feature migration status

Baseline: DSH Wallpaper Engine v1.4.0 at `3b0103bc1d5431840208966ce67155f392c4095c`. The Codex bridge keeps its own host, local settings, launcher and native surface mappings.

| Feature | Implementation | Acceptance |
| --- | --- | --- |
| Scene rendering | Optional WebWallGL 3.0.0, package and loose-directory broker, bounded viewport, scripts, pointer, pause/disposal | Synthetic tests and two native Scene probes; see WEBWALLGL.md |
| Web rendering | Existing Wallpaper Engine native capture | Generated native Web animation: 21 changing capture frames / 1.6s; WebWallGL Web channel remains pending |
| Library | Unmodified upstream picker model; 24-item pages, type/rating filters, bounded previews, batch hide/restore and checked-item batch save | Synthetic and installed Codex preview/inspection, checked batch save, duplicate dialogs and deletion passed; hides never delete source projects |
| Rotation | Host-owned scheduler, imported image/video lists, sequential/shuffle, exclude hidden/current, defer while background | Synthetic automatic rotation and background deferral passed |
| Appearance presets | Codex-specific versioned JSON whitelist, local save/apply/delete/import/export; transactional rollback | Unit and UI roundtrip passed; no paths/media/account data exported |
| Glass/fonts | Existing Codex selectors plus blur/opacity, local font families and sizes | Synthetic style application and installed settings-panel visual review |
| FX | Unmodified upstream click/trail renderer with a small shared-scope adapter and native accent mapping | Synthetic create/remove checks; reduced motion and background behavior honored |
| Background parallax | Codex-specific bounded pointer mapping with time-smoothing and idle stop | Synthetic input and transform checked |
| Playback | Flip, video speed, muted-by-default WebGL scene volume, first-frame fade-in | Lightweight video copies have no audio track; native capture has no audio transport; volume is enabled only for WebGL |
| System music | Optional pinned media-bridge adapter, metadata/control capabilities and spectrum channel | Real nonzero WASAPI-to-Scene pixels and zero restoration passed; OS fixture controls passed, complete current-player controls partially failed on Windows session switching; identity guard added |
| Panel sizing | Embedded resize grip, keyboard sizing, persisted size and reset | Synthetic and installed Codex mouse drag, reopen persistence and reset accepted; no independent window |
| DSH pet choreography | Excluded by user | No pet work in this follow-up; character assets are not copied |
| Startup animation | Upstream first-frame fade and switch transitions inspected | See STARTUP-EFFECTS.md; no branded intro installed |

This is a feature migration, not a DSH client rebuild. The new controls use the existing Codex settings panel. The optional engine is prepared in private runtime data; no wallpaper images, character packages, font files or native helper binaries are added to Git.
