# Changelog

## Unreleased — source candidate

- Add an Install.cmd entry that prepares missing dependencies through WinGet, deploys checksum-verified source into versioned user directories, prepares GPU/native runtimes and creates unified desktop/Start-menu shortcuts. Preserve settings, source downloads and the running client; record optional FFmpeg/uv paths for Explorer launches. Rewrite newcomer-facing setup, configuration, advantages, upgrade and troubleshooting documentation.

- Add eleven reviewed screenshots from the actual desktop client on an empty new-chat screen, with private fields hidden before capture and self-made gallery thumbnails. Expand the Chinese README with a gallery, renderer choices, preparation steps and remaining acceptance limits. Keep runtime capture scripts and source assets outside the repository; allow only exact documentation PNG paths with raw-byte hashes and metadata/CRC checks.

- Refine the wallpaper panel with theme-aware layered surfaces, consistent desktop control sizing, clearer preview and advanced-setting groups, and quieter batch/close actions. Adapt principles from awesome-design-md's Linear/Raycast analyses without external fonts, images or new runtime dependencies; preserve the original handlers and settings.

- Make the root README Chinese, retain an English translation, and document a reviewed demonstration-image workflow without publishing real chat screenshots or wallpaper assets.
- Reuse version-validated media fingerprints and bounded previews, deliver scene bytes before disk-cache persistence, and use file-backed cache responses to reduce transient copies. Keep dimensions, FPS limits and effects unchanged.
- Restore verified native Codex windows on explicit launcher clicks and require visible, non-minimized foreground readback. Match the main page geometry or a process/target-bound handle rather than treating CDP Page.bringToFront as native-window restoration; healthy main pages no longer request redundant package activation. Actual taskbar-click and cross-DPI acceptance remain pending.
- Offer opt-in event-driven recovery for a future package update: one graceful attempt, no force termination, no custom resident watcher and no promise of update immunity.

- Use the official default Codex profile for future launches, scan main instances across Store versions, and stop rather than open a second root when identity or graceful exit cannot be confirmed. Rediscover the registered package before launch; preserve the original taskbar pin and document its cold-start limitation.
- Replace the periodic process supervisor with a one-shot entry/bootstrap. Validate bootstrap/client identities on explicit clicks, and exit the wallpaper bridge on browser disconnect. Keep the necessary wallpaper/media connection while the client is running.
- Record actual portable PowerShell/Node paths during build, so native Explorer launches do not depend on an updated PATH. Verify the actual executable with empty PATH in an inspection mode that preserves existing clients.
- Atomically overwrite existing launch status with a same-directory move; avoid PowerShell converting File.Replace's null backup argument into an invalid empty path on repeated starts.
- Copy the complete original `icon-chatgpt.ico` from the official package instead of extracting a small icon or converting a transparent logo. Apply complete official taskbar relaunch properties only to verified owned windows.

- Restore native embedded-browser mouse input by keeping the main application root at its native stacking level; a positive root z-index placed transparent panes above body-portaled browser guests and intercepted clicks/wheel input.

- Capture system audio only while an eligible WebGL scene is active; stop capture in video/empty/background states, clear stale spectrum once, and coalesce unchanged media properties and closed-panel updates. Reuse scene media sources and separate five-second position corrections.
- Add an optional one-click power-saving playback preset (960px, 12 FPS, pause on blur), with empty-library support and failure restoration.

- Fix periodic helper restarts: parse only top-level JSON heartbeat rather than overwriting it with nested taskbar timestamps. Add adoption of an existing helper during supervisor upgrades.
- Inspect the selected project before import and display its actual realtime requirement; invalidate cached scene inspection when project/package metadata changes.
- Separate deletion selection from active wallpaper selection; inactive deletion does not reload, and active deletion never silently starts a realtime neighbor.
- Honor the chosen import resolution/FPS for newly converted local and Wallpaper Engine media.
- Move wallpaper settings by dragging its title or using arrow keys; remember and clamp the panel position. Increase panel opacity for readable text.
- Extend native surface rules to floating navigation, side chat and summary panels; include detached windows and separately style embedded ChatGPT/GPT webviews. Add a reviewed coverage matrix without claiming every-page visual acceptance.
- Replace the fixed wallpaper-entry coordinates with an inline native menu-row control. Match the inspected right-pane root, panel background variable, browser toolbar and new-tab canvas instead of relying on guessed component names.
- Repeated unified-launcher clicks activate the existing wallpaper window. Ordinary-session switching closes it gracefully before creating the wallpaper session instead of preserving two independent clients.
- Realtime capture now uses an offscreen non-activating tool window, records bounded phase/error diagnostics, parses split stderr lines, and preserves the current run's diagnostics during profile changes.
- Correct capture pacing and delivered-frame sequence tracking; combine frame delivery with status, use bounded parallel delivery, account for work in pacing, and pass frames through a stable CDP object instead of compiling large JavaScript strings.

- Split selected import into import-and-apply and save-only; duplicate saves retain the active background.
- Dismissible failure dialogs, selection locking and empty-selection handling.
- Automatically adapt native page surfaces and retain only two folded native-background preferences: code/terminal and embedded pages. Migrate retired layout switches while preserving relevant opt-outs.
- Use native surface tokens for library/site/GPT/profile/file-tree coverage; keep menus and dialogs solid and readable.
- Add a version-gated native terminal theme adapter with original-theme restoration and container-remount tracking; verify native toggles, persistence and leave/return behavior in the installed client.
- Record actual page visits across all native navigation areas, 29 settings destinations and workspace panels, including unavailable/loading-state limits.
- Opt-in native Wallpaper Engine scene/web rendering, per-window Windows.Graphics.Capture, bounded in-memory JPEG transport and canvas playback.
- Mandatory confirmation before realtime import/application; saved references do not start rendering.
- Realtime output resolution/capture FPS controls; global render settings remain user-managed.
- Dedicated-window cleanup, first-frame rollback and capture-error fallback to the last media wallpaper.
- Pinned Python capture dependencies and explicit setup; manual acceptance steps in docs/REALTIME.md.

The development runtime was exercised with native capture, canvas playback, offscreen source windows and targeted source-close recovery. At a 1280/24 output cap the measured presented rate was approximately 18 FPS; this is not a universal performance guarantee or acceptance of every scene. See docs/VALIDATION.md for the portable candidate's remaining boundaries.

## 0.1.0-alpha.0 — unpublished source candidate

- Static/animated media backgrounds, in-app management and wallpaper-derived colors.
- Wallpaper Engine library discovery, bounded folder search and optional ordinary media search.
- Hot playback profile conversion, bounded playback storage and background pause.
- Settings-surface styling and separate message/composer space.
- Portable dependency discovery, external runtime data directory and no automatic screenshot capture.
- Minimal vendored dependencies, synthetic tests, privacy allowlist and release documentation.

Full native cold-start and taskbar integration for this portable candidate remain unverified. No public release or push has occurred during preparation.
# 2026-10-24

- Add an optional, separately prepared WebWallGL 3.0.0 Scene renderer with sandboxed scripts, bounded project reads, first-frame adoption, pointer and pause forwarding, and explicit native/WebGL selection.
- Keep Web wallpapers on the existing native renderer pending a separate resource/script compatibility gate. Preserve third-party notices and record native vs synthetic acceptance separately in docs/WEBWALLGL.md.
- Reuse the upstream picker/FX model for paged wallpaper previews, filters, batch hide/restore, click/trail effects; add transactional portable presets, Codex glass/fonts, background parallax, first-frame fade-in and foreground image/video rotation.
