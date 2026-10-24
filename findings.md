# Migration findings

- Codex bridge has image/video, library discovery, native capture, a single-instance launcher and scoped native surface mappings. Preserve these.
- DSH depends on Cordis/webServer/client runtime/React/slots; wholesale installation into Codex is unavailable.
- WebWallGL 3.0.0 has a self-contained global browser bundle already prepared locally. Its source is MIT; wallpaper assets are separate and never redistributed.
- A sandboxed blob iframe is allowed by native CSP; the old prototype transfers scene bytes with CDP and creates an isolated execution world. HTTP embedding failed previously.
- Candidate direct reuse: upstream picker-model, fx-layer, parallax algorithms. Rotation and presets require a host-neutral adapter.
