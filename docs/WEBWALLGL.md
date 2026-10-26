# Optional WebWallGL renderer

Prepare the pinned browser runtime with `npm run prepare:webwallgl`. It downloads npm `webwallgl@3.0.0`, verifies the package SHA-512, and extracts only the browser script, package metadata and original MIT license into the private data directory. No package installation scripts run. Set the same `CODEX_WALLPAPER_DATA_DIR` for preparation and the host.

Select **WebGL 场景** when importing a Scene project. The confirmation explains that its scripts execute in an opaque `sandbox="allow-scripts"` iframe. It has no same-origin permission, Codex DOM access, account bridge, or general filesystem access. Its resource reader is restricted to the selected canonical project directory, rejects traversal/junction escapes, and enforces per-file and per-load budgets. Application wallpapers are never executed.

Scene packages and loose scene directories use the same broker. No local HTTP endpoint, CSP bypass, client package modification or native source window is required. The previous background stays in place while loading; only the ready candidate is adopted. Changing background, failed mounts and shutdown destroy the engine, listeners, pending buffers and iframe URLs. Focus/visibility/reduced-motion state and pointer coordinates travel through a per-instance message token.

The requested maximum width and FPS are quality limits, not performance guarantees. Video texture precision is adjustable; ordinary defaults retain half-size upload. Scene volume starts muted. Optional live system spectrum is gated by source state and fresh frames; unavailable external input uses zero spectrum. Explicitly disabling response disables scene frequency processing instead of substituting simulated input. See SYSTEM-MEDIA.md. Scripts execute only in the isolated wallpaper context. Effects, shared engine assets, codecs and individual scripts can still differ from Wallpaper Engine itself. Highest-tier full projects now prefer the separately confirmed native route; WebGL remains explicitly selectable.

## Verified scope, 2026-10-24

- Isolated Chromium: loose Scene first frame, bounded canvas, pixel readback, pointer API, pause/resume, disposal and missing-resource cleanup.
- Installed Windows Codex: two locally owned Scene packages rendered nonempty frames; pixels changed over time, pause/resume and candidate disposal worked. One complex scene observed about 20-24 FPS at width 1280. This is a sample, not a benchmark guarantee.
- Native probe initially ran scripts off, then repeated with scripts on and no warning diagnostics in the sampled tail. Original background was retained throughout probing.
- Web wallpaper relative-resource/script loading is **not accepted for this renderer** yet. It remains available through the existing native real-time mode. Do not infer Web support from Scene acceptance.
- Pointer API delivery is checked; full visual parity of each wallpaper's mouse effects is not established.

Run `npm run test:webwallgl` after preparing the runtime for an isolated synthetic test. It never attaches to a real Codex session. Native evidence and wallpaper images remain outside this source checkout.
