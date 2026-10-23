# Security and trust boundary

This experimental integration requires local debugging access to the desktop client. A CDP endpoint can expose more than wallpaper controls, including access to the renderer; use it only on a trusted local machine. Never bind it to `0.0.0.0`, forward it, or publish its browser/profile data.

The startup path verifies the installed official package and the ownership/identity of the loopback endpoint. The host targets the Codex shell, not arbitrary web pages. UI actions carry a per-connection token; search imports use server-issued path tokens and re-check canonical paths. These are defensive checks, not a sandbox against a malicious local administrator or another process with debugging access.

No installer changes the official package, signature, ACL, global execution policy, or content security policy. The default launcher does not force-close an ordinary running client. Optional restart/wait switches require deliberate use; prefer saving drafts and exiting the client yourself.

Only trusted local media should be imported. Media decoding, FFmpeg and scene-package parsers may have bugs; keep dependencies updated. Wallpaper scripts/web apps are not executed. Scene support extracts a single video layer rather than executing the full scene.

To report a vulnerability after publication, use repository private vulnerability reporting if the maintainer enables it. Do not disclose account data or exploitable private details in a public issue. There is no maintainer email in this unpublished candidate.
