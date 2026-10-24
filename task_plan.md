# DSH feature reuse into Codex

Authorized 2026-10-24. Baseline: 1c1036e. Preserve the official client and the existing Codex bridge. Commit reviewed milestones locally; do not push.

## Phases
- [x] Read current runtime, clean Git state and completed startup commits; other implementation chat is idle.
- [ ] Prove a sandboxed WebWallGL Scene/Web path in isolated Chromium and the installed Codex; check first frame, switching, pause, interaction and disposal. Keep native capture available.
- [ ] Integrate the proven renderer behind an explicit renderer choice with transactional failure recovery and save-only imports.
- [ ] Reuse upstream library filtering, add rotation and portable appearance presets.
- [ ] Reuse optional glass/font/effects/parallax modules through Codex mappings.
- [ ] Assess music and pet host contracts; implement only supported paths and document concrete remaining boundaries.
- [ ] Review changes, meaningful tests, release allowlist, runtime deployment and separate Git commits.

## Acceptance
- Synthetic browser results and native Codex results are distinct.
- No workshop assets, runtime profiles or private configuration in Git.
- Renderer success requires actual frame evidence; failure preserves the previous background.
- No CSP bypass or client package mutation. Scene scripts remain in an opaque sandbox.

## Findings / errors
- Existing historical blob-frame prototype already ran WebWallGL; an HTTP frame was blocked by native CSP. Reuse that finding, recheck with bounded resolution rather than rebuilding an HTTP embedding route.
- Local checkout upstream v1.4.0 is two README-only commits behind the previously checked main.
- Source paths guessed as renderer/lib.ts and node_modules/webwallgl did not exist. Actual API is renderer/src/api and the prepared global bundle is available in the earlier scene probe.
