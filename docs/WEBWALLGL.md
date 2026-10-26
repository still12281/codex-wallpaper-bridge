# Optional WebWallGL renderer

Prepare the pinned browser runtime with `npm run prepare:webwallgl`. It downloads npm `webwallgl@3.0.0`, verifies the package SHA-512, and extracts only the browser script, package metadata and original MIT license into the private data directory. No package installation scripts run. Set the same `CODEX_WALLPAPER_DATA_DIR` for preparation and the host.

Select **WebGL 场景** when importing a Scene project. The confirmation explains that its scripts execute in an opaque `sandbox="allow-scripts"` iframe. It has no same-origin permission, Codex DOM access, account bridge, or general filesystem access. Its resource reader is restricted to the selected canonical project directory, rejects traversal/junction escapes, and enforces per-file and per-load budgets. Application wallpapers are never executed.

Scene packages and loose scene directories use the same broker. No local HTTP endpoint, CSP bypass, client package modification or native source window is required. The previous background stays in place while loading; only the ready candidate is adopted. Changing background, failed mounts and shutdown destroy the engine, listeners, pending buffers and iframe URLs. Focus/visibility/reduced-motion state and pointer coordinates travel through a per-instance message token.

The requested maximum width and FPS are quality limits, not performance guarantees. Video texture precision is adjustable; ordinary defaults retain half-size upload. Scene volume starts muted. Optional live system spectrum is gated by source state and fresh frames; unavailable external input uses zero spectrum. Explicitly disabling response disables scene frequency processing instead of substituting simulated input. See SYSTEM-MEDIA.md. Scripts execute only in the isolated wallpaper context. Effects, shared engine assets, codecs and individual scripts can still differ from Wallpaper Engine itself. The 4K tier uses an exact 3840×2160 canvas, full video-texture precision and explicit quality settings, scaled to cover the Codex viewport. The renderer control source is reused from DSH v1.4.0 under MIT; a capability-backed resource source replaces its HTTP source, and cached 64-band system audio replaces same-origin parent access. Source assets still transfer only during loading over CDP; frames render directly on the GPU. This is not the entire DSH plugin, its HTTP service or proof of universal Wallpaper Engine compatibility.

## Verified scope, 2026-10-24

- Isolated Chromium: loose Scene first frame, bounded canvas, pixel readback, pointer API, pause/resume, disposal and missing-resource cleanup.
- Installed Windows Codex: two locally owned Scene packages rendered nonempty frames; pixels changed over time, pause/resume and candidate disposal worked. One complex scene observed about 20-24 FPS at width 1280. This is a sample, not a benchmark guarantee.
- Native probe initially ran scripts off, then repeated with scripts on and no warning diagnostics in the sampled tail. Original background was retained throughout probing.
- Web wallpaper relative-resource/script loading is **not accepted for this renderer** yet. It remains available through the existing native real-time mode. Do not infer Web support from Scene acceptance.
- Pointer API delivery is checked; full visual parity of each wallpaper's mouse effects is not established.

Run `npm run test:webwallgl` after preparing the runtime for an isolated synthetic test. It never attaches to a real Codex session. Native evidence and wallpaper images remain outside this source checkout.

## Saved-scene switching, 2026-10-26

Saved scene selection directly applies the already authorized library entry, without repeating the import confirmation. Selecting a healthy current wallpaper is a no-op; an unhealthy current renderer can still be reapplied.

Scene resources are cached only in `codex-wallpaper-resources-v1` in the Codex profile CacheStorage. Keys include the validated project root, relative resource name, size and modification metadata. The opaque iframe cannot access app storage: the trusted host validates the resource path/version first, then the app page transfers the cached ArrayBuffer to the candidate using a token and transferable buffer. A cache hit skips disk reads and CDP/Base64 retransmission. Misses use 4 MiB batches and the browser's native Base64 decoder when available. The older per-byte iframe decoding loop is removed from the normal path; a compatibility fallback remains for older browsers.

Only regenerable assets are stored, at most four entries / 512 MiB total, with a 256 MiB per-resource cap and eviction before adding a new item. No inactive GPU renderer is kept solely to accelerate switching. CacheStorage is in the existing Codex profile, not the wallpaper data directory, and is not part of a library backup. The management section exposes clearing this cache without deleting source wallpapers or the current frame. The `cwb-cache.invalid` URLs are storage identifiers; no requests are sent to that domain.

Actual Codex: a 212,117,705-byte scene reached its first probe frame in 8.85 seconds while filling cache and 1.71 seconds on the next load. A deployed library roundtrip displayed the main frame in 1.40 seconds and completed both windows in 3.03 seconds, with zero additional resource bytes transmitted. Re-selecting the healthy current item took approximately 4 ms and kept the renderer object. These are bounded samples of the current scene/quality, not universal or cold-start guarantees.

## Logical wallpapers and live selection, 2026-10-26

The saved selector now shows one logical wallpaper per Workshop/project identity. Legacy video/WebGL/native records remain available as rendering versions; no source assets are deleted during grouping. New project imports check duplicates across rendering methods. Renderer choice remains inside the project's settings, including a saved media version when present.

The saved selector now updates only the preview; **确定切换** applies the chosen wallpaper. Browsing can continue while a confirmed choice is loading; obsolete queued requests are skipped and in-progress candidates are canceled before adoption. Each candidate captures its selection ticket. Page stamps protect native asynchronous decoding and GPU/media adoption; late media deliveries verify their candidate id. Adopted GPU players are no longer affected by cancellation of later candidates. Cache waits can be abandoned when a newer selection arrives.

Images and videos now share the bounded resource cache. A disposed GPU iframe is not called again during old-player cleanup: the real OOPIF previously could add approximately 20 seconds of RPC waiting after the new background was already visible.

Actual Codex, current user settings and warm resources: six playback records collapsed to five visible wallpapers; video first frame 386–409 ms / both windows 827–864 ms, GPU first frame 1,095–1,288 ms / both windows 2,231–2,447 ms. In the earlier immediate-selection trial, three rapid choices completed the final choice in 196 ms, with obsolete replies skipped, the original final frame retained and no error dialog. Original selection, all library records and saved preferences were restored/retained. These samples do not promise instant switching for cold or arbitrary large scenes.

Latest UI revision: preview selection is pinned separately from the active wallpaper. Finishing an already confirmed switch does not replace a newer thumbnail selection; choosing another preview never sends a wallpaper-selection action. The existing cache, grouping and confirmed-selection cancellation remain in place.
