# Migration findings

- Codex bridge has image/video, library discovery, native capture, a single-instance launcher and scoped native surface mappings. Preserve these.
- DSH depends on Cordis/webServer/client runtime/React/slots; wholesale installation into Codex is unavailable.
- WebWallGL 3.0.0 has a self-contained global browser bundle already prepared locally. Its source is MIT; wallpaper assets are separate and never redistributed.
- A sandboxed blob iframe is allowed by native CSP; the old prototype transfers scene bytes with CDP and creates an isolated execution world. HTTP embedding failed previously.
- Candidate direct reuse: upstream picker-model, fx-layer, parallax algorithms. Rotation and presets require a host-neutral adapter.

- Exact upstream picker-model and FX sources are retained unchanged and hash-checked. Code adapters provide shared-scope variables; presets use a new explicit Codex schema instead of copying asset-bearing DSH snapshots.
- Independent review caught media rollback/removal, resize, resource concurrency, listener cleanup, rotation locking and thumbnail memory limits. Implemented candidate media layers, bounded logical iframe size, queued asset reads, explicit disposal, serialized scheduler and 8 MiB/96-item preview cache.
- Transport `id` is reserved for request correlation; preset actions use `presetId`. UI roundtrip caught and fixed the field collision that direct action unit tests did not expose.
- Empty synthetic scenes can enter the engine's idle state; resume acceptance checks the paused state, while native dynamic scenes independently provide changing-pixel evidence. A transient early frame-navigation failure was diagnosed with frame/target inventory; repeated full sandbox runs subsequently passed.
