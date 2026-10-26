# Security and trust boundary

This experimental integration requires local debugging access to the desktop client. A CDP endpoint can expose more than wallpaper controls, including access to the renderer; use it only on a trusted local machine. Never bind it to `0.0.0.0`, forward it, or publish its browser/profile data.

The startup path verifies the installed official package and the ownership/identity of the loopback endpoint. The host targets the Codex shell, not arbitrary web pages. UI actions carry a per-connection token; search imports use server-issued path tokens and re-check canonical paths. These are defensive checks, not a sandbox against a malicious local administrator or another process with debugging access.

No installer changes the official package, signature, ACL, global execution policy, or content security policy. The default launcher does not force-close an ordinary running client. Optional restart/wait switches require deliberate use; prefer saving drafts and exiting the client yourself.

Only trusted local media and projects should be imported. Media decoding, FFmpeg and scene-package parsers may have bugs; keep dependencies updated. Lightweight video-layer mode does not execute scene scripts. Optional WebGL Scene mode executes project scripts in an opaque `sandbox="allow-scripts"` iframe with a project-restricted resource broker. Native full-scene/web mode executes the project through the separately installed Wallpaper Engine, outside that iframe sandbox. Application wallpapers are not launched. Both live project routes retain the explicit confirmation step.

The highest scene tier prefers the native route after confirmation. Only the uniquely named, project-owned source window is captured; the desktop and chat are not capture sources. Per-window properties can be copied from the matching desktop project's saved settings, but desktop selections and global quality settings are not modified. This route still has capture/encoding/display costs and does not forward mouse interaction.

Library backups contain private settings, local paths and owned media. Store them outside the source repository and do not upload them as diagnostics. The maintenance tool restores into a separate empty directory, checks asset hashes and preserves external project references without copying or deleting those projects. Imported backups should still be treated as trusted local configuration.

To report a vulnerability after publication, use repository private vulnerability reporting if the maintainer enables it. Do not disclose account data or exploitable private details in a public issue. There is no maintainer email in this unpublished candidate.
