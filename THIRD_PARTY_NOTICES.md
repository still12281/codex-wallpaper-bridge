# Third-party notices

Optional browser rendering uses npm `webwallgl@3.0.0` (MIT, oneincase), prepared separately by `tools/prepare-webwallgl.mjs` using a pinned SHA-512 package digest. The browser bundle and wallpaper assets are not redistributed here. The runtime preparation preserves the original license beside the script. Source: https://github.com/oneincase/webwallgl .

DSH Wallpaper Engine v1.4.0, commit `3b0103bc1d5431840208966ce67155f392c4095c`, contributes the unmodified picker model and FX layer under `vendor/dsh-wallpaper/` (MIT, Copyright (c) 2026 elysia395). Host adapters are original Codex bridge code. No DSH character images, preset-embedded assets or fonts are copied. Source: https://github.com/elysia395/dsh-wallpaper-engine .

Realtime capture optionally installs `windows-capture==2.0.1` (MIT), `numpy==2.2.6` (BSD-3-Clause) and `opencv-python==4.12.0.88` (Apache-2.0 wrapper, with its bundled-component notices) into a separate local uv environment. These packages and binaries are not redistributed in this source repository. Preserve installed distribution licenses if packaging them later. Artifacts and hashes are pinned in `src/capture-scene.py.lock`; source: https://pypi.org/project/windows-capture/2.0.1/ .

Original project code proposes MIT. The following vendored sources keep their original licenses and headers. No code in these vendor copies was modified during candidate preparation.

| Component | Source / pinned revision | Included files | License |
| --- | --- | --- | --- |
| Codex-Dynamic-Skin | https://github.com/CCDawn/Codex-Dynamic-Skin — `5a0e74043b63ed9518ab37cdcf6865340a57006c` (local tag v1.7.3) | `windows/scripts/common-windows.ps1`, `config-utf8.ps1` | [MIT](vendor/codex-dynamic-skin/LICENSE) |
| WebWallGL | https://github.com/oneincase/webwallgl — `197abe54266c31d346cebc314e49a26b70c960cc` (local package 3.0.0) | `renderer/vendor/we-scene/pkg/{container,texture,tex-codecs,limits}.js` | [WebWallGL MIT](vendor/webwallgl/LICENSE), [we-scene MIT](vendor/webwallgl/we-scene/LICENSE) |

The Windows helpers are used for official package discovery, verified local CDP identity and launch operations. Their other installation/theme functions are not called by this project; the full helper source is retained to preserve the audited dependency closure.

The scene parser dependency is limited to four source files. The complete WebWallGL renderer, its assets, npm dependencies, and Wallpaper Engine content are not bundled.

FFmpeg is a separately installed executable, not redistributed here. Its own license/build options apply separately. Node.js, PowerShell, the Windows/.NET runtime, Codex and Wallpaper Engine are also separately supplied software. Local icon extraction during launcher setup does not grant rights to redistribute the original brand asset.

The original and vendored file hashes are recorded in `docs/UPSTREAM-SOURCES.json`. Upstream copyright names and the contact address present in an original third-party license are public attribution, not this maintainer's identity.
