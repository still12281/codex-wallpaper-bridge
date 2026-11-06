# Changelog

## Unreleased

## 0.1.0-alpha.4 — 2026-11-06

- Wake the existing host when a trusted main/detached page appears or navigates, rather than waiting for the healthy-page idle interval. Apply a temporary palette before scene preparation and on subsequent document loads, retaining native animation and input; remove it after real wallpaper styling takes over. Restrict it to allowed top-level app documents and preserve the original native phase before CDP becomes available. Include one focused generated-browser transition check.
- Recover missing CIM process paths through an exact native PID/session/start-time/path snapshot, and ignore stale enumeration rows only after a fresh query confirms exit. During entry startup and graceful update shutdown, allow the same unreadable live identity to settle within bounded waits, preserving new or unverifiable clients. Manual recovery remains independent of consumed automatic-update state and launches the current registered package with the saved configuration. Add focused exit-race and update-runner regressions.
- Revalidate already verified clients through a retained native process handle, checking exact start time, executable, session, loopback listener ownership and browser identity before reuse. Fall back to full discovery when a native handle cannot be retained. Batch independent renderer setup work and wake readiness checks through the existing validated binding while preserving sampled readiness, cancellation and timeout fallback. Keep render resolution, FPS, effects and resource boundaries unchanged.
- Keep the wallpaper theme consistent when native shell hydration changes root theme attributes after an early first frame. Observe only root theme/class/style changes, repair only mismatched theme signals, preserve unrelated native state and restore the initial theme snapshot when wallpaper is disabled. Verify actual native text colours, late hydration, observer settling and disposal in the generated early-startup fixture. Record host handoff, endpoint revalidation and process-start stages separately for future cold-start measurements.
- Avoid recompiling the native process/TCP helpers on each entry by using an optional locally built support assembly. Check both source hashes and the DLL hash, use a fixed cache path, and fall back to source when missing, stale, damaged, incompatible, or partially loaded. Add a support-only build mode that leaves the entry executable untouched. Consolidate endpoint validation into one listener/process check before and after HTTP inspection, preserving app-target requirements and native process identity checks.
- Fix rapid exit/reopen handoff: closed CDP sockets immediately reject pending/new calls so WebGL cleanup does not wait for remote timeouts; allow an old wallpaper host to finish naturally before rechecking ownership. Once a client is verified, later setup failures preserve it without closing or reopening it. Add an attach-only recovery path and accept a ready visible detached window when the main page is intentionally deferred while hidden. Include generated WebGL disconnect, host-handoff, and verified-client failure regressions.
- Read fresh IPv4/IPv6 TCP listener ownership through the Windows IP Helper API during entry startup, retaining PID/address verification without repeated slow networking-provider queries. Cold starts launch the validated Store executable with debugging arguments directly, defer shortcut maintenance until the wallpaper is ready, and include query time in the shutdown-drain deadline. Windows socket and real-bootstrap fixtures cover listener identity, released ports, direct-first cold launch, single package discovery and existing-client preservation. Actual taskbar cold-start timing still requires normal-exit acceptance.
- Prepare the wallpaper host as soon as the newly launched browser exposes a verified loopback endpoint, bound to that launch's exact process identity. Mount backgrounds when the exact app document has a body/head, allowing preparation to overlap native shell initialization. Keep native terminal adaptation behind shell readiness and place late menu controls through the existing observer. Generated-browser fixtures verify that a real image paints before the shell and survives late shell/menu creation; the latest change still needs real-client cold-start acceptance.

## 0.1.0-alpha.3 — 2026-11-04

- Launch entry, inspection, update, host and validated direct-client helpers with native handle isolation. Use an explicit standard-stream handle list for log redirection, preserve short-lived exit status, and provide a one-shot external-app launch utility. Add Windows socket regressions that keep the child alive after its parent exits and verify immediate port release.

- Recover from an occupied/stale default debugging port by preserving its owner and selecting a free loopback port from 9335–9354. Persist only a verified endpoint hint, recheck same-session main-process identity on reuse, pass the port to taskbar/update recovery, and recheck availability before launch. Preserve ordinary running clients and stable entry mutexes; no process termination or public binding is introduced.

- Prioritize and publish the main wallpaper before detached/embedded synchronization, defer taskbar alignment, and poll briefly while the initial shell is pending. Add bounded optional-cache reads with cancellation and original-file fallback; cache initialization no longer gates resource delivery. Keep render quality and limits unchanged, record startup phases, and test suspended auxiliary pages, delayed shells and late cache results in isolated browsers.

- Fix exit/reopen races: wait briefly for a preceding explicit client shutdown, distinguish helper leftovers from live main processes, preserve new activations, and stop prelaunch errors from reopening ordinary Codex without wallpaper arguments. Ordinary fallback now requires a client created and verified by that same bootstrap. A one-shot client reopen restored both main and detached wallpaper windows.

## 0.1.0-alpha.2 — 2026-11-04

- Add opt-in current-user login startup through the stable wallpaper entry, preventing the official ordinary startup task from opening an unattachable client first. Back up the exact original native State, preserve unrelated registry values, check shortcut ownership, support read-only inspection and guarded restoration, and roll back failed setup. Default install/upgrade behavior remains `keep`; no client is closed or watcher installed. Include isolated startup regressions in CI.

## 0.1.0-alpha.1 — 2026-10-29

- Resolve native terminal theme managers by one validated interface in the already loaded module instead of fixed bundle/export names. Distinguish armed/zero terminals from actual adaptation, recover delayed module loading, and report terminal theme status separately from wallpaper readiness.

## 0.1.0-alpha.0 — 2026-10-28

- Add a stable installed Repair.cmd that opens the ordinary wallpaper entry only after the user confirms a normal exit. Document manual recovery independent of automatic update attempts, preserve settings, and switch distribution instructions to versioned Release ZIP packages with SHA-256 files.

- Offer separate/original-shortcut replacement modes with persisted startup policy, exact backups and guarded restoration. Recognize verified Store shortcut identities, preserve unrelated/document shortcuts, and add noninteractive/no-pause install commands plus an explicit update-recovery choice. Normalize Task Scheduler principal names to SIDs when validating an existing update task.

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
