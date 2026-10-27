# Codex Wallpaper Bridge

The 4K tier renders at 3840×2160. Scene projects can use the DSH v1.4.0 renderer control source with WebWallGL directly inside a sandboxed iframe, or the installed Wallpaper Engine through native capture after confirmation. Native capture preserves original engine effects, scripts and audio processing and follows the desktop frame-rate cap. Capture latency and compression remain measurable differences, and native mouse forwarding is not implemented. See [realtime mode](docs/REALTIME.md) and [local maintenance](docs/MAINTENANCE.zh-CN.md).

[简体中文](README.zh-CN.md)

An experimental, local wallpaper layer for the Codex desktop app on Windows. Pick static images or animated videos inside Codex, browse installed Wallpaper Engine libraries, and adjust playback quality without restarting the client.

**Status: source-only alpha candidate.** This is an independent community project, not an official OpenAI plugin or Wallpaper Engine integration. It relies on local Chromium debugging and private UI selectors, which can change between client versions. No release binaries, accounts, wallpapers, screenshots, or user configuration are included.

## Features

- Optional sandboxed WebGL scenes and native scene/web capture, with confirmation, save-only references and failure recovery. Native sample acceptance and limits: [WebGL](docs/WEBWALLGL.md), [realtime](docs/REALTIME.md).
- Paged thumbnails, type/rating filters, hide/restore, portable appearance presets, saved media/GPU/native-project rotation, glass, fonts, parallax and click/trail FX.
- Optional [system media](docs/SYSTEM-MEDIA.md), off by default.
- Resize the embedded settings panel from its lower-right grip; drag its title, remember its size, or reset it. No separate window.

- In-app wallpaper library, local imports, switching, and deletion of app-owned copies.
- Default search limited to discovered Wallpaper Engine libraries across local disks, including Workshop, custom projects, and built-in projects.
- Optional folder search for Wallpaper projects or ordinary images/videos.
- Wallpaper-derived colors across the chat, sidebar, and common settings surfaces.
- Separate message and composer space to keep transparent input controls readable.
- Silent video playback, pause on loss of focus, adjustable resolution/frame limits, and hot application after conversion.
- One current playback file per wallpaper; previous playback copies are replaced after successful decode.
- Optional hidden Windows launcher. Its build uses the locally installed client icon; no OpenAI icon is redistributed.

## Requirements

- Windows 10/11, x64, with the official Microsoft Store Codex client installed.
- Node.js 22 or later and PowerShell 7.
- FFmpeg with H.264 and WebP encoders, supplied separately. Set `CODEX_WALLPAPER_FFMPEG` if it is not on PATH or discoverable from a local WinGet installation.
- Wallpaper Engine only for Wallpaper Engine library features. Local image/video imports do not require it.
- .NET Framework C# compiler for the optional GUI launcher.

There are no production npm dependencies. The required parsing and Windows helper sources are vendored with their original licenses; see [third-party notices](THIRD_PARTY_NOTICES.md).

## Setup

1. Review [security](SECURITY.md), [privacy](PRIVACY.md), and the [current validation limits](docs/VALIDATION.md).
2. Ensure `node.exe`, `pwsh.exe`, and FFmpeg are available. Optional overrides are documented in [configuration](docs/CONFIGURATION.md).
3. In PowerShell 7, from this checkout:

   ```powershell
   ./windows/Build-Launcher.ps1
   ./windows/Prepare-TaskbarEntry.ps1
   ```

4. The scripts create `CodexEntry.exe` and `Codex.lnk` under `%LOCALAPPDATA%\CodexWallpaperBridge`, or your configured data directory. They do not replace existing desktop shortcuts or taskbar pins. If the checkout moves, rebuild the launcher.
5. Save drafts and fully exit the ordinary Codex client yourself. Open the generated shortcut to request a local debugging session and load the wallpaper controls. If launch verification fails, inspect the local launch status instead of repeatedly restarting the client. Cold-start compatibility is still experimental.
6. If desired, manually replace an old taskbar pin with this generated shortcut. A shared icon/AppID does not redirect an existing Store pin. Startup animation is not implemented.

For an **already verified local Codex debugging session**, `npm start` attaches the host to loopback port 9335. It does not enable debugging on an ordinary running client. Do not expose the port to a network.

## Use

Open **壁纸** in the client. The current UI is in Chinese.

- **搜索 Wallpaper 壁纸 / 图片 / 视频** defaults to Wallpaper Engine + discovered global libraries. Change to a folder to search a particular project/library.
- **其它图片 / 视频** searches a chosen folder and its descendants. It does not scan every image/video on every drive by default.
- My-library selection previews a thumbnail and renderer label; apply and delete are explicit buttons. Selected import inspection stays beside its preview.
- Checked imports save the whole selection without changing the active background. Duplicate items prompt or appear in a batch summary; file content hashes distinguish renamed copies from changed contents.
- Choose a result and import it. Direct imports accept JPG, PNG, WebP, GIF, MP4, and WebM, subject to size/format limits.
- Choose resolution and FPS, then apply. Conversion takes time; the host switches after decoding the new copy. Default: 1280-wide, 24 FPS, muted, pause in the background. High settings and large sources can still cost CPU/GPU time.
- Delete removes app-owned records and unreferenced app copies, never Workshop or external source files.

Auto mode routes audio-processing scenes to native realtime confirmation; other extractable scenes can still use the video layer. WebGL mode supports sandboxed scene scripts with project-dependent compatibility. Web wallpapers use native capture; WebGL Web resource loading is not yet accepted. See the [feature migration status](docs/FEATURE-MIGRATION.md). Pet choreography remains excluded.

## Development

```text
src/        Host, local actions, UI styling, discovery and conversion
windows/    Launcher source, build/setup scripts and folder picker
vendor/     Minimal third-party source and unchanged licenses
test/       Synthetic tests; no personal wallpaper or conversation fixtures
tools/      Release allowlist, content and checksum checks
docs/       Configuration, architecture, validation and release checklist
```

```powershell
npm test
npm run check:privacy
# Optional: local Chrome/Chromium + FFmpeg, isolated synthetic page only
npm run test:integration
```

No tests should attach to a real Codex session or copy a real account profile. The integration test uses a temporary isolated browser profile and generated media. Test reports are local; do not publish real client logs or screenshots without reviewing them.

## License and acknowledgements

The candidate proposes MIT for original code; the maintainer must confirm this before publishing. Third-party files retain their own MIT notices. Wallpapers and proprietary client software are not part of this license. OpenAI, Codex, Steam, and Wallpaper Engine names belong to their respective owners; no affiliation is implied.

Maintainer identity and repository links are intentionally unset. Complete [the release checklist](docs/RELEASE_CHECKLIST.zh-CN.md) before publishing.
