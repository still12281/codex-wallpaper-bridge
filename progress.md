# Migration progress

## 2026-10-26 完整计划整理

- 用户要求把最近两轮待办完整展开并判断是否换对话；新增 `docs/EXECUTION-PLAN-20261026.zh-CN.md`，T01—T14 映射到 A—E 五个执行包，每包含工作项、依赖、验收和提交边界。
- `task_plan.md` 顶部指向当前完整计划；历史实施记录保留，最新“先预览、确定切换”继续有效。建议新对话从 A 开始，后续自然阶段再换；未创建新聊天。
- 本轮仅更新计划与项目记录，不改源码、部署、用户配置或当前客户端，不执行渲染/导入等功能测试。覆盖和发布检查结果以本轮最终提交说明为准。

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

## 2026-10-26 执行进展

- 完成独立备份、基线/入口修复提交及原生最高档接入；多窗口状态不再互相覆盖，候选解码成功前保留旧源。
- 原生短测、真实音频环、慢窗口隔离与坏候选保留通过；15 分钟稳定性和有界故障/清理验收正在收尾。
- 新增备份恢复/项目路径诊断工具并完成真实库往返和针对性测试；文档中的旧脚本/自动路由/Git 状态已更新。
- 启动器已部署并完成空 PATH 的真实入口自检；未关闭或重启 Codex。任务栏实际分组等用户侧原生验收仍保留为未知。

最终验收：固定 905.84 秒原生采样通过，平均 27.30 次画布更新/秒，callback-to-draw P95 88.81ms，无目标错误或连续停帧。故障关闭自有源后自动回退视频且 Python 退出；当前客户端没有重启。堆使用中位数基本稳定，RSS 波动仍如实记录，不声称长期无泄漏。最终部署恢复原生最高档和用户失焦暂停偏好。

最终边界修复 875a1d8：原生高级规格保留比例和品质，超时目标隔离不再追加；1900ms 延迟目标仅收到两次绘制，主窗口 28.04 次/秒，重新应用恢复。末尾版本单独短测 28.77 次/秒/P95 92.81ms，未重复整套稳定性测试。原始偏好字段与原视频记录逐项对比一致，源码与部署 src 全部一致。

- 2026-10-26：续接中断的可用性修改。入口 e90b9d1；实际 4K 原生约 11.09 canvas/s，DSH GPU 约 29.96 renderer FPS。原生焦点重建路径移除；标准内嵌窗口实际指针检查通过。详见 docs/USABILITY-20261026.md；冷启、首次原生创建闪烁观察和长期 GPU 显存仍未验收。

- 2026-10-26：修复已导入场景切换重复加载。当前场景实测主画面约 1.40 秒、两窗口约 3.03 秒；健康当前项不重建。专用缓存最大 512 MiB，保留当前显示档位和偏好。

- 2026-10-26：项目归并与选择即切换已部署。真实 6→5 个项目，暖缓存视频约 0.4 秒、GPU 约 1.1–1.3 秒；连续选择仅最后一次生效，旧 OOPIF 清理等待已修复，原素材/库记录与当前偏好保留。

- 2026-10-26：按新反馈恢复“先看预览 → 确定切换”；浏览不改背景，确认后的快速切换继续复用缓存。
