# Migration progress

2026-10-24: Baseline clean at 1c1036e. Previous implementation chat idle. Read launcher/current runtime and upstream API. Started read-only upstream-module review. No production runtime changes yet.

WebWallGL milestone: added a bounded project capability, opaque sandbox runtime, pinned optional runtime preparation, renderer mode and meaningful tests. Chromium fixture and two native Codex scene probes passed (including script-enabled repeat). Native Web loading remains a separate unsatisfied gate, so it is explicitly rejected by this mode. Existing native capture remains available.

Errors resolved: first fixture mount raced document navigation/layout; wait for the synthetic document to complete before installing. A missing source path was investigated through actual file inventory. No production files or settings have been deployed yet.

Library/appearance milestone: upstream picker and FX adapters, page/preview/filter/hide UI, appearance presets, glass/fonts/flip/speed/volume, parallax and a foreground rotation scheduler. Tests cover 17 unit cases and an isolated Chromium UI flow including presets, effects cleanup, page filtering, automatic rotation and background deferral. Fixed the transport presetId collision and the baseline/default-settings mismatch; did not weaken those assertions.

Installed milestones 8ed012c and 52ead67 into the existing local host with explicit backups, retaining the official client process and restoring the user selection after native audits. Implemented optional system media and embedded panel size controls; 18 unit tests, extended Chromium UI flow and WebGL spectrum attach/detach passed. Native media tests verified running WASAPI and silent events only; player controls were not automatically invoked. Final native panel/deployment acceptance follows separately.

Final installed acceptance: panel v5 mouse resize 440x780→504x700, reopen persistence and reset passed. Metadata-only enable/read/disable passed and original media settings restored. Native library audit passed again with WebGL scene startup, save-only and return-to-video cleanup. Fresh native WASAPI sample delivered 22 events and stale-frame detachment passed. Original Codex browser identity retained; no independent settings window. Private native evidence remains in the external development evidence directory.

Follow-up: my-library previews with explicit apply/delete, sticky selected import inspection, checked batch save and duplicate modals/content hashes implemented. 24 unit tests and extended isolated UI flow passed. Installed native audit saved two fixtures without applying, skipped both on repeat, showed single duplicate modal and deleted only its fixtures. Real WASAPI-to-WebGL generated Scene produced changing pixels and zero restoration. OS fixture controls passed; real current-player restore failed after Windows changed current application, so exact-session recovery restored original music. Current-player controls are partial; source guard/readback failure UI accepted. Startup effects inspected only; pet integration excluded by user.
## 2026-10-25 tier follow-up
Read current source/status and user images. Planning files refreshed; readonly tier review delegated, main agent owns writes. Screenshot faults not yet reproduced or repaired.

2026-10-25 latest: 5 display tiers plus custom integrated; current native Codex static/dispose/audio-stop/economy/custom-restore verified. 44 unit tests plus isolated lifecycle and UI wiring/theme tests passed. Raw native capture pilot: 68 frames, 12.27 FPS, 8 distinct initial hashes; owned window/helper stopped, desktop selection unchanged. Native in-Codex latency/high-FPS/long-run remains unaccepted. Evidence stays outside Git in ReleaseWork/display-tiers.

Readonly review corrections accepted: media reconciliation on all apply/fallback paths; native-full confirmation clears static mode; advanced custom settings discard obsolete restore snapshots. Added regression tests for both state-restoration cases.
## Reopened-client and visible regression follow-up, 2026-10-25

- Implemented explicit interface theme, independent glass opacity, panel/option contrast, real advanced scene-quality controls and in-memory paused-frame preservation.
- Repaired entry identity, bootstrap failure reporting, same-browser host reuse and capture-success recognition; diagnostic runs preserve launch identity.
- Native visual and taskbar cold-start acceptance is pending because the current official client was opened without CDP. Existing client and preferences remain preserved.

## 2026-10-25：最高档执行计划整理

- 已核对已有原生引擎采集路线、源码/部署一致性与当前真实运行证据，更新主次顺序：先完整原生场景，再性能/延迟，最后可靠性与版本收尾。
- task_plan.md 新计划纳入多窗口状态遗漏、路线能力说明、文档矛盾、备份恢复/素材重定位、停用卸载、鼠标交互缺口和任务栏验收。
- 本阶段仅计划与记录；运行时、用户配置和当前客户端均未改动。计划提交独立于已有未提交实现；保留旧阶段记录并标注其结论已被当前运行证据部分取代。
- 验证策略：计划仅审查差异及发布清单；后续按真实风险定向验证、阶段关键验收一次，避免重复全量与无关测试。每个重要实现阶段提交本地 Git，不自动推送。
