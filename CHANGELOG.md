# Changelog

## 0.4.2

### Security & Fixes

- **First-run confirmation for saved live wallpapers**. Saving or batch-saving live wallpapers (WebGL, native Wallpaper Engine, or experimental Chromium Web) now stores entries as pending first-run confirmation (`needsRunConfirmation`) without running them. Automatic rotation skips unconfirmed entries, saved cards/previews/rotation checklists display confirmation state, and the first manual apply prompts once and persists approval per project and renderer. Previously saved libraries remain authorized on upgrade.
- **ZIP `Install.cmd` executable lookup**. Prioritize `CODEX_WALLPAPER_PWSH`, standard fixed install paths (`%ProgramFiles%\PowerShell\7\pwsh.exe`, `%LOCALAPPDATA%\Microsoft\WindowsApps\pwsh.exe`, `%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe`), and `%SystemRoot%\System32\where.exe $PATH:...` while excluding the current working directory and script directory (both long and 8.3 short paths).
- **Minimal WebGL frame-navigation diagnostics**. Strip full `frameTree` dumps and unrelated iframe URLs, query parameters, and titles from WebGL sandbox navigation errors, keeping only structured reason codes, match flags, and counts.
- **Bounded async HTML serving in experimental Chromium Web mode**. Enforce the `8 MiB` size limit and bounded asynchronous stream reading across all `.html`/`.htm` files served for a project (normalized by `path.resolve` before routing so trailing-slash or `/.` variants cannot fall through to synchronous reads), while keeping vendored `vendor/dsh-wallpaper/serve.js` unmodified.
- **Multi-user directory guidance**. Document in `SECURITY.md`, `README.md`, `README.en.md`, and `docs/INSTALL.zh-CN.md` that multi-user Windows systems should keep the default `%LOCALAPPDATA%\CodexWallpaperBridge` directory because non-system drives commonly inherit `Authenticated Users` Modify permissions.

### Performance

- **Keep live wallpaper streaming during catalog search and folder selection**. Move read-only `engine-list` directory scanning and `engine-pick-folder` dialogs outside the action lock that pauses `stream()` frame delivery, entering the serialized queue only briefly to persist `settings.engineSearch`.

## 0.4.1

### Improvements

- **Rotation wallpaper checklist**. Replace the native multi-select list in **特效与联动 → 壁纸轮播** with a clickable checkbox list showing each wallpaper's mode tag, live selected count, and a **清空勾选** action. Leaving all items unchecked continues to rotate through all saved wallpapers.

### Fixes

- Fix excessive vertical whitespace and narrow `190 px` sizing on stacked rows in the embedded control panel (affecting the rotation wallpaper picker).
- Bind the 6-card display-tier grid's 3-column breakpoint to the panel content width (`<= 620 px`) so tier labels remain unclipped at the default `700 × 580` window size.
- Stack multi-control rows (**渲染方式**, **外观预设**, **删除指定壁纸**) cleanly across narrow and default widths, keep media playback icon buttons aligned without shrinking or overlapping long track status text, and restore the divider above **立即扫描并适配**.

## 0.4.0

### Highlights

- Redesigned five-tab System Settings control panel with responsive narrow-width navigation
- 2K (`2560 / 30 FPS`) display tier preset
- Per-wallpaper renderer memory and stricter queued-edit binding

### New features

- **Control panel redesign**. Reorganize the embedded panel into five sidebar tabs (`我的壁纸`, `外观与遮罩`, `画质与播放`, `特效与联动`, `适配与管理`) with a compact five-icon top bar below `620 px`, hero preview card, six display-tier cards, segmented controls, switches, sidebar status indicator, and floating toast feedback. Free 8-edge resizing, maximize, and window geometry persistence remain available.
- **2K display tier**. Add a 2K (`2560 / 30 FPS`) preset alongside the existing display tiers.
- **Per-wallpaper renderer preference**. Remember each wallpaper's manually selected renderer across switches and restarts, keeping renderer selections and queued edits tied to the active wallpaper entry.

### Fixes

- Reuse loaded GPU scenes after saving a sampled wallpaper palette.
- Preserve native anchors for project previews and tooltips.
- Publish the first launcher before enabling startup integrations, and keep the launcher usable when disabling optional startup fails.
- Release dropped imports cleanly and initialize `rendererPreferenceMigrated` in default settings for fresh configurations.

## 0.3.7

- Reuse a verified installer when retrying an update to the same version. Report the failed preparation step and its setup log in the wallpaper panel.
- Reuse native capture environments that match the dependency lock and pass a runtime check. Continue to a usable 64-bit Python 3.12 when an earlier candidate fails.

## 0.3.6

- Keep sidebar chat previews anchored beside their rows by applying the glass effect to the visible card.
- Keep “扫描并适配” in the menu bar when a hover preview opens. The scan control remains available in interactive menus and dialogs.

## 0.3.5

- Reduce repeated transcript style checks during typing, composition, and scrolling in supported Codex chat layouts. Recheck the scrollport and footer only when their structure or composer mode changes.
- Keep “扫描并适配” clickable from the menu bar and supported menus and dialogs. Show scan progress and results in the active layer and retain the current dialog.

## 0.3.4

- Reduce brief stalls after fast scrolling in supported Codex chat layouts. Keep the native reading anchor, and use Codex's original styling when the layout is unfamiliar.

## 0.3.3

- Reload the current wallpaper and reconnect audio from the wallpaper panel. Use the installed `Repair.cmd` to reattach an offline host.
- Use native scrollport clipping for supported translucent composers, and an opaque footer for other layouts.

## 0.3.2

- Launch the verified setup EXE directly from the wallpaper panel. Keep the previous launcher active until setup completes, and record the result separately from the running wallpaper host.
- Default to standard setup with PowerShell 7, Node.js, WebWallGL and stereo spectrum. Offer image/video import and original Wallpaper Engine capture as optional components.
- Discover PowerShell 7 installed via MSI or an MSIX app execution alias. Reuse verified WebWallGL and existing Python capture environments during upgrades.

## 0.3.1

- Recover WebGL spectrum capture when updates stall during system audio playback. Skip stale spectrum samples and show the active, paused, or recovering state in the wallpaper panel.
- Bring the existing Codex window forward from the taskbar and recover the wallpaper connection after a brief interruption. Reuse a loaded scene when possible and keep the previous wallpaper frame visible until a fresh frame is drawn.
- Reduce redundant layout reads during pointer movement, native control clicks and transcript scrolling. Preserve click effects and cursor trails across the Codex window.
- Reuse measured character widths when reopening terminal tabs with the same font and display settings. Avoid rewriting an unchanged terminal theme and trim blank edges during ordinary text selection.

## 0.3.0

### Highlights

- Six stereo spectrum rates for WebGL wallpapers
- Release notifications and one-click updates in the wallpaper panel
- Optional AMD hardware transport for Wallpaper Engine scenes
- Pointer effects that adapt to the wallpaper palette

### New features

- **Stereo spectrum**. Open **系统音乐联动** and enable WebGL audio response. Choose 10, 20, 30, 60, 90 or 120 updates per second. The default is 30, and the panel shows the measured incoming rate. The installer prepares the verified audio component.
- **One-click updates**. Open **版本与更新** to check for a stable release and download its verified installer. The upgrade preserves your library and integration choices. Exit Codex normally and reopen the wallpaper entry to activate the installed version.
- **AMD hardware transport**. Select **原版硬件传帧（AMD）** for a saved Wallpaper Engine scene. The capture window mutes the scene soundtrack while retaining its response to system audio. The bridge falls back to JPEG capture for that scene if hardware transport is unavailable.
- **Adaptive pointer effects**. In **玻璃、字体与特效**, enable click effects or cursor trails. The automatic color and blending options use the wallpaper palette so effects remain visible on light and dark scenes.

### Startup and reading fixes

- Preserve a taskbar launch request while the previous request finishes. Start the next instance once the old main process exits, even while old renderer helpers are cleaning up.
- Bring a visible Codex window forward while wallpaper preparation is still in progress. Restore a hidden window through its bound Codex page, and show a concise error when the wallpaper host exits before its first frame.
- Present the first wallpaper frame without the fade used when switching wallpapers. Keep transcript clipping synchronized with scrolling to prevent old text from briefly showing through the composer.
- Skip wallpaper compositing filters when blur is zero and brightness is unchanged.

## 0.2.2 — 2026-11-17

- Budget code-reader and terminal tint together with the wallpaper overlay, reducing compounded whitening or darkening while keeping text contrast and existing font settings.
- Apply raised glass to native roleless composer suggestions, expanded command trays and actual global-search cards. Keep positioning wrappers and internal cmdk lists transparent, preserve selection colours, and protect owned cards and alert dialogs from neutral-background scans.
- Keep thinking-indicator and scroll updates local: use exact class selectors and non-inheriting transcript/code clipping offsets to avoid restyling the application and text descendants.
- Preserve a glass-aware RGB reference in transparent terminal themes for reverse video, restore the standard opaque ANSI palette, and enforce minimum text contrast while restoring native settings on opt-out.
- Match Markdown code-block materials and syntax colours to the wallpaper. Keep sticky code controls transparent while occluding source text behind them; preserve native code-background preferences.
- Use one shell material policy for saved composer/card glass and raised translucent menus, comments and previews. Preserve semantic action colours and native-background options.
- Keep diff-tooltip positioning space transparent; paint only the actual preview card instead of its fixed-height outer box.
- Clip transcript painting at the native composer boundary, including streamed content and resized composers, while preserving native scroll dimensions and positions.
- Support terminal managers exposed directly by native modules or already present in an executed Rspack runtime cache, without invoking module factories or reading PTY data.
- Scan owned pages with Ctrl+Alt+Shift+W while a native menu or modal is open, with a result notification that retains the current dialog and focus.
- Give “页面适配与原生底色” the same bordered group styling as the other wallpaper controls.
- Persist palettes with each logical wallpaper so reopening, switching renderer variants and restarting the host reuse the same colours.
- Write runtime status atomically and identify loaded source builds. Release document paint listeners when stopping the wallpaper host.
- Keep solid-button labels, neutral text and icons paired with the wallpaper theme when native theme settings load after startup. Preserve composer placeholder visibility through the startup-to-wallpaper handoff.

## 0.2.1 — 2026-11-10

- Add an English/Simplified Chinese EXE setup wizard with separate program/data folders, existing-install discovery and shortcut/startup choices. Register Windows Apps uninstall, restore owned integrations and preserve wallpaper data and user-modified shortcuts.
- Put wallpaper selection and its preview first in the control panel. Group wallpaper-library browsing and local imports below the preview, and return to the selector when reopening the panel.
- Group display tiers, renderer selection and custom playback settings under “播放与画质”. Move the one-shot scan into “页面适配与原生底色” and keep library management below appearance settings.

## 0.2.0 — 2026-11-09

- Carry forward automatic theme installation for owned documents and nested frames, plus the on-demand surface scan introduced in alpha.7, into the regular 0.2.0 release.
- Fix the native existing-client entry's foreground permission handoff: retain the grant for Codex instead of transferring it to the Node transport helper. Record fresh permission and activation outcomes, including failures. A restored visible window that Windows declines to foreground is reported separately instead of opening a misleading startup-failure modal; hidden/minimized or identity-changed windows still fail without rebuilding the client.
- Compatibility, regression coverage and reproduction notes are documented in [Validation](docs/VALIDATION.md).

## 0.1.0-alpha.7 — 2026-11-09

- Add a “扫描并适配” control for a one-shot rescan of all currently open owned documents, including the native shell and nested plugin frames. Report newly adapted backgrounds, skipped/failed documents and bounded-pass limits; preserve wallpaper playback, settings and native opt-outs. No recurring scan is scheduled.

- Apply shared wallpaper CSS to trusted shell pages, owned webviews and nested frames through document lifecycle events. Remove ChatGPT-only selection and repeated embedded-style polling. Keep native-shell startup ahead of optional surface integration, and retain semantic colours, images and native input.
- Use persistent constructed stylesheets under strict CSP, with one bounded read-before-write neutral-background pass per embedded document; skip that pass on native shells. Cover opaque native guest parents structurally rather than by provider name. Exclude wallpaper renderers and unrelated browser pages, restore all contexts on disable/removal, and send only theme parameters to embedded content.
- Replace theme repair observers with explicit theme writes and persistent text tokens; install startup colours before parser scripts without a DOM observer. Unknown late hardcoded content remains outside automatic guarantees.

## 0.1.0-alpha.6 — 2026-11-07

- Restore the wallpaper control entry when the native application-menu CSS class format changes. Locate the native menu by its trigger and menubar role, retain both known class formats, and keep a visible fallback when the menu is absent. Reposition after native-menu removal, replacement or late creation without restarting the client or wallpaper renderer.
- Report control-entry visibility separately from wallpaper readiness. Add a focused generated-browser regression for pointer opening, the appearance action roundtrip, menu changes and preservation of the background and draft; run it in Windows CI. Record control-entry checks separately from installer checks.
- Restore the control entry in the installed client without replacing the wallpaper renderer or changing settings. The user confirmed that the real control panel opens, operates and closes normally.

## 0.1.0-alpha.5 — 2026-11-06

- Restore tray-resident clients through Codex's own current-main-window display message, then verify internal visibility and native foreground state. Reuse a verified native main-window binding before the full bootstrap; reconnect a stale wallpaper host after the window is shown. Keep the current chat and client process.
- Bind cached main HWNDs to a per-window cookie and exact process/session/browser identity, retaining the binding across renderer-target replacement and rejecting reused, foreign or destroyed windows. Refresh the binding after the real main shell is ready.
- Add focused activation transport and hidden-native-window regressions. Real tray close/taskbar reopen completed in 0.874 seconds and the user confirmed working clicks and scrolling.

## 0.1.0-alpha.4 — 2026-11-06

- Wake the existing host when a trusted main/detached page appears or navigates, rather than waiting for the healthy-page idle interval. Apply a temporary palette before scene preparation and on subsequent document loads, retaining native animation and input; remove it after real wallpaper styling takes over. Restrict it to allowed top-level app documents and preserve the original native phase before CDP becomes available. Include one focused generated-browser transition check.
- Recover missing CIM process paths through an exact native PID/session/start-time/path snapshot, and ignore stale enumeration rows only after a fresh query confirms exit. During entry startup and graceful update shutdown, allow the same unreadable live identity to settle within bounded waits, preserving new or unverifiable clients. Manual recovery remains independent of consumed automatic-update state and launches the current registered package with the saved configuration. Add focused exit-race and update-runner regressions.
- Revalidate already verified clients through a retained native process handle, checking exact start time, executable, session, loopback listener ownership and browser identity before reuse. Fall back to full discovery when a native handle cannot be retained. Batch independent renderer setup work and wake readiness checks through the existing validated binding while preserving sampled readiness, cancellation and timeout fallback. Keep render resolution, FPS, effects and resource boundaries unchanged.
- Keep the wallpaper theme consistent when native shell hydration changes root theme attributes after an early first frame. Observe only root theme/class/style changes, repair only mismatched theme signals, preserve unrelated native state and restore the initial theme snapshot when wallpaper is disabled. Verify actual native text colours, late hydration, observer settling and disposal in the generated early-startup fixture. Record host handoff, endpoint revalidation and process-start stages separately for future cold-start measurements.
- Avoid recompiling the native process/TCP helpers on each entry by using an optional locally built support assembly. Check both source hashes and the DLL hash, use a fixed cache path, and fall back to source when missing, stale, damaged, incompatible, or partially loaded. Add a support-only build mode that leaves the entry executable untouched. Consolidate endpoint validation into one listener/process check before and after HTTP inspection, preserving app-target requirements and native process identity checks.
- Fix rapid exit/reopen handoff: closed CDP sockets immediately reject pending/new calls so WebGL cleanup does not wait for remote timeouts; allow an old wallpaper host to finish naturally before rechecking ownership. Once a client is verified, later setup failures preserve it without closing or reopening it. Add an attach-only recovery path and accept a ready visible detached window when the main page is intentionally deferred while hidden. Include generated WebGL disconnect, host-handoff, and verified-client failure regressions.
- Read fresh IPv4/IPv6 TCP listener ownership through the Windows IP Helper API during entry startup, retaining PID/address verification without repeated slow networking-provider queries. Cold starts launch the validated Store executable with debugging arguments directly, defer shortcut maintenance until the wallpaper is ready, and include query time in the shutdown-drain deadline. Windows socket and real-bootstrap fixtures cover listener identity, released ports, direct-first cold launch, single package discovery and existing-client preservation. Normal exit followed by one taskbar-entry click restored the installed client wallpaper on 2026-11-06.
- Prepare the wallpaper host as soon as the newly launched browser exposes a verified loopback endpoint, bound to that launch's exact process identity. Mount backgrounds when the exact app document has a body/head, allowing preparation to overlap native shell initialization. Keep native terminal adaptation behind shell readiness and place late menu controls through the existing observer. Generated-browser fixtures verify that a real image paints before the shell and survives late shell/menu creation; real-client normal-exit recovery was recorded on 2026-11-06.

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
- Restore verified native Codex windows on explicit launcher clicks and require visible, non-minimized foreground readback. Match the main page geometry or a process/target-bound handle rather than treating CDP Page.bringToFront as native-window restoration; healthy main pages no longer request redundant package activation. At this release stage, read-only native window matching passed; taskbar-click and cross-DPI checks had not run.
- Offer opt-in event-driven recovery for a future package update: one normal-close request per new version, a persisted handled-version record and exit after event processing.

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

The development runtime was exercised with native capture, canvas playback, offscreen source windows and targeted source-close recovery. At a 1280/24 output cap the tested scene measured approximately 18 canvas updates/s. Scene, environment and measurement records are listed in docs/VALIDATION.md.

## 0.1.0-alpha.0 — initial source preparation

- Static/animated media backgrounds, in-app management and wallpaper-derived colors.
- Wallpaper Engine library discovery, bounded folder search and optional ordinary media search.
- Hot playback profile conversion, bounded playback storage and background pause.
- Settings-surface styling and separate message/composer space.
- Portable dependency discovery, external runtime data directory and no automatic screenshot capture.
- Minimal vendored dependencies, synthetic tests, privacy allowlist and release documentation.

Initial preparation record: native cold-start and taskbar integration checks had not run at that stage. Public release followed this preparation.
# 2026-10-24

- Add an optional, separately prepared WebWallGL 3.0.0 Scene renderer with sandboxed scripts, bounded project reads, first-frame adoption, pointer and pause forwarding, and explicit native/WebGL selection.
- Keep Web wallpapers on the existing native renderer pending a separate resource/script compatibility gate. Preserve third-party notices and record native vs synthetic acceptance separately in docs/WEBWALLGL.md.
- Reuse the upstream picker/FX model for paged wallpaper previews, filters, batch hide/restore, click/trail effects; add transactional portable presets, Codex glass/fonts, background parallax, first-frame fade-in and foreground image/video rotation.
