# Configuration

All overrides are optional and evaluated locally. Do not publish real environment values.

| Variable | Use |
| --- | --- |
| `CODEX_WALLPAPER_DATA_DIR` | Absolute data directory. Defaults to the user's local application data folder, `CodexWallpaperBridge`. Keep it outside the repository. |
| `CODEX_WALLPAPER_PWSH` | PowerShell 7 executable; otherwise discovered from PATH / the standard installation. |
| `CODEX_WALLPAPER_NODE` | Node executable for the Windows launcher script; otherwise `node.exe` from PATH. |
| `CODEX_WALLPAPER_FFMPEG` | FFmpeg executable; otherwise PATH or a supported local WinGet package is searched. |
| `CODEX_WALLPAPER_TEST_CHROME` | Browser executable for the optional isolated integration test only. |

`settings.example.json` is intentionally empty. On first run, a private `settings.json` is created in the data directory. The UI writes the wallpaper library, playback limits, selection, palette and last folder there. New UI instances default to Wallpaper Engine + global discovered libraries; ordinary media requires an explicit folder.

Media imports are limited to 250 MiB. Default playback copies are limited to 32 MiB; higher profiles allow up to 128 MiB. Allowed widths: 960/1280/1920/2560/3840. FPS caps: 12/24/30/60. These are output caps; the converter does not upscale small sources or synthesize higher source frame rates.

Folder search skips symbolic links/junctions and has limits: 6,000 directories, 3,000 results, depth 12 and approximately 15 seconds. Reaching a cap is reported. Global discovery reads installed/registered Steam libraries, selected engine configuration paths and a limited local-drive probe. Arbitrarily named, unregistered libraries can be supplied through folder search; a complete recursive scan of every drive is not performed.

The standard startup port is 9335 and is bound to loopback by the launcher. The host validates loopback WebSocket URLs. Do not use public addresses or add CDP bypasses. For development, invoke `node src/video-cdp-host.mjs --cdp-port <local-port>` only against your own verified client; the synthetic integration test uses its own temporary port and profile.
