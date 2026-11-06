# Configuration

All overrides are optional and evaluated locally. Do not publish real environment values.

For normal installation and in-app setup, follow the [Chinese installation guide](INSTALL.zh-CN.md). `Install.cmd` prepares dependencies and copies reviewed source into a versioned private installation. Choose `-ShortcutMode separate` for a dedicated entry, `replace` to back up and replace identified official `.lnk` files, or `none`. `installation.json` remembers the choice; separate/none also prevent later startup from rewriting official shortcuts. `Restore-Shortcuts.ps1` restores unchanged replacements from verified backups and disables subsequent automatic replacement. Store registration and taskbar pinning remain separate Windows operations.

Use `-UpdateReconnect enable/keep/disable` to opt into, preserve or remove the event-only future-update rule. `-NonInteractive -NoPause` makes the command-line installation unattended at the script level; OS installer consent can still appear. Installation preserves wallpaper settings and does not launch or close Codex. The built entry records PowerShell, Node and supplied FFmpeg/uv executable paths so desktop launches do not depend on a refreshed PATH.

From alpha.2, `-LoginStartup enable/keep/disable` controls the separate current-user login path; the default `keep` makes no change. Enabling backs up and disables the matching official native startup task and creates a managed shortcut to the stable wallpaper entry. `windows/Set-LoginStartup.ps1 -Root <data directory> -Mode inspect` is read-only; `enable` and `disable` configure or restore the managed login path. Disable this feature before moving/removing the data directory. See [login startup](LOGIN-STARTUP.zh-CN.md) for ownership checks, restoration and acceptance limits.

| Variable | Use |
| --- | --- |
| `CODEX_WALLPAPER_DATA_DIR` | Absolute data directory. Defaults to the user's local application data folder, `CodexWallpaperBridge`. Keep it outside the repository. |
| `CODEX_WALLPAPER_PWSH` | PowerShell 7 executable; otherwise discovered from PATH / the standard installation. |
| `CODEX_WALLPAPER_NODE` | Node executable for the Windows launcher script; otherwise `node.exe` from PATH. |
| `CODEX_WALLPAPER_FFMPEG` | FFmpeg executable; otherwise PATH or a supported local WinGet package is searched. |
| `CODEX_WALLPAPER_UV` | uv executable used to prepare/run native capture; the installer records its resolved path. |
| `CODEX_WALLPAPER_TEST_CHROME` | Browser executable for the optional isolated integration test only. |

`settings.example.json` is intentionally empty. On first run, a private `settings.json` is created in the data directory. The UI writes the wallpaper library, playback limits, selection, palette and last folder there. New UI instances default to Wallpaper Engine + global discovered libraries; ordinary media requires an explicit folder.

The native local file picker and media catalog support large video files without the former 250 MiB upload or 32/128 MiB playback-file limits. Videos use file-backed Blob URLs with on-demand browser reads; preparation still creates a managed copy/remux/transcode as needed, requires disk space, reserves 64 MiB, and remains cancellable. The legacy browser-upload API retains its 250 MiB limit. Image copies retain 32/128 MiB protection. Allowed widths: 960/1280/1920/2560/3840; media FPS caps: 12/24/30/60. The converter does not upscale sources or synthesize higher source frame rates. These changes do not remove GPU scene package/resource budgets; see [large-media evidence and limits](LARGE-MEDIA-20261027.zh-CN.md).

The former hidden power-saving button was retired. The explicit Economy display tier applies its documented budgets to the selected wallpaper while preserving saved audio/focus preferences. Video conversion is skipped when the current copy already matches the requested playback profile. Saved selection updates the preview; the explicit confirm-switch button applies it. Rendering versions of the same project are grouped into one visible item.

Folder search skips symbolic links/junctions and has limits: 6,000 directories, 3,000 results, depth 12 and approximately 15 seconds. Reaching a cap is reported. Global discovery reads installed/registered Steam libraries, selected engine configuration paths and a limited local-drive probe. Arbitrarily named, unregistered libraries can be supplied through folder search; a complete recursive scan of every drive is not performed.

The preferred startup port is 9335. If occupied without a verified reusable client, the launcher preserves the occupant and chooses a free port from 9335–9354. `cdp-endpoint.json` and `runtime-status.json` provide port hints only: every reuse rechecks a unique, same-session official main-process owner, its creation identity, and the live CDP endpoint. Connections remain loopback-only. The host and taskbar helper receive the selected port; update recovery checks saved candidates as well. Do not use public addresses or add CDP bypasses. For development, invoke `node src/video-cdp-host.mjs --cdp-port <local-port>` only against your own verified client; `npm start` remains a manual diagnostic default for 9335, and synthetic integration uses temporary ports/profiles.

Every integrated-entry launch checks the currently registered package and preserves the last successful version in `entry-health.json`. Replacement mode maintains matching managed shortcuts under the saved installation policy; separate and none modes preserve official shortcuts. A package-update relaunch can omit debugging arguments. Enable the [automatic update recovery task](AFTER-UPDATE-RECONNECT.zh-CN.md) to reconnect after that event, or use [manual recovery](INSTALL.zh-CN.md#更新后壁纸消失手动恢复).

The [automatic update recovery task](AFTER-UPDATE-RECONNECT.zh-CN.md) runs once per new version and exits after handling the event. It records the version before taking action and preserves clients that refuse to exit; duplicate events for that version are skipped. Installation records the current package version, latest event ID and activation time in `update-reconnect.json`. `Install-UpdateReconnect.ps1 -Root <existing data directory>` enables it; `-Uninstall` removes the task.

`rendererPriority` selects the automatic import route: `{ "scene": "webwallgl", "web": "native" }` is the current smoothness/compatibility preference. Scene also accepts `native`; Web also accepts `chromium-web` (experimental). This affects automatic imports, preserves existing selected versions, and does not remove explicit renderer choices.
