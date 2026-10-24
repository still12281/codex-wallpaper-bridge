# Changelog

## Unreleased — source candidate

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
- Five independent wallpaper surface controls and current composer/menu styling updates.
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
