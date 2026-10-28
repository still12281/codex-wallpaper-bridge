# Migration progress

## 2026-10-28 无损优化、任务栏唤回与中文发布材料

从915046c干净续接，优化提交50e9e22。指纹/预览复用、先首帧后有界缓存落盘和减少重复IPC已部署；只重载自有宿主21264→27528，客户端browser identity/根进程、settings完整字节和13条库保留。实际212MB隐藏候选1478→870ms、主页面采样backing峰值249.4→47.0MiB；没有承诺总内存降回1GB。两个Sol/high只读子代理均遇模型容量不足中止，由主代理完成审查。性能首轮拦截漏evaluate而比较无效，补实际v6/v7断言后重测；WebGL集成缺默认引擎后显式指定已有引擎通过；错误与证据保留于性能记录。

用户随后指定根README中文，并追加任务栏未完全退出时不能唤回。已补原生主窗口精确匹配、正常恢复/显示、前台许可及读回，不再用CDP bringToFront回执冒充可见成功；现有主窗口只读定位/RememberOnly和策略测试通过，新入口空PATH检查通过，真实任务栏点击仍待用户正常操作。中文README、独立英文版、演示图清单和alpha准备清单完成；源码/历史扫描与第三方哈希检查结果按最终清单记录，不创建GitHub仓库或推送。实际上传前需恢复gh登录和确认发布信息。

## 2026-10-27 Web路线与大场景首载提速

从干净42bd3fb核对部署后，通用Web选择现有WE专用窗口采集路线，保留GPU Web禁用及CSP。大包主要瓶颈为Base64/CDP，新增围栏内浏览器文件读取和底层取消，保留协议缺失后备。212MB场景真实Codex隐藏候选旧6.92秒，最终部署主/分离1.60/1.32秒。四模块备份部署后37模块一致、9条库和配置字节不变、客户端和一体入口不变；提速提交19d326e，未推送。内存定向归因已结束，确认部分资源可回收、三次清理无节点/监听累积；browser进程增长仍未完全解释。采样器退出竞态、有效样本与短段补测详见docs/FOLLOWUP-20261027.zh-CN.md，未把首段失败说成passed，全部临时诊断退出。

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
# 2026-10-26 执行包 A 启动

- 已核对计划和干净 Git 基线；只读检查主/分离客户端 DOM，保留当前媒体、外观/音频/暂停设置。
- 主代理负责实现；只读子代理复核 A1—A4，未并发写文件。代表尺寸与操作验证使用隔离环境，真实客户端只做一次相关复核。
- A2—A4 已实现；定向面板检查通过，实际引用栏/语义浮层材质样例通过。复核补齐 busy config render 的删除按钮与异步检查锁定。
- 五个模块已备份部署并仅热刷新 UI，主/分离窗口 v14；渲染器对象/媒体节点/暂停/播放时间/窗口几何记录保持不变，配置 SHA-256 一致。未重启 Codex、宿主或背景。
- 详细覆盖、设计参考、证据索引和未验收项见 docs/PACKAGE-A-20261026.zh-CN.md。空 runtime-status 与缺失旧宿主作为 B 开始前的真实链路核查项；未打开浮层/额度卡片仍待视觉验收。

## 2026-10-26 执行包 B 首批部署

- 恢复失联宿主后真实请求往返正常，全部配置字段一致；旧退出原因未知。
- 实施预检/copy/remux/必要转码、容量确认和实际限制、独立版本事务、2MiB上传、有界转换缓存、进度/旁路取消、批量失败重试与断连清理。独立只读复核修正了取消复活、确认仍提交、上传创建竞态和取消误计成功等边界。
- 定向10项、隔离真实宿主取消及合成端到端通过。实际Codex上传取消、仅保存合成PNG再删除本次项通过，配置全部字段相同，Codex没有重启。
- 部署B仅替换自有宿主，当前媒体会重新装配；不将A热更新时播放位置保留的结论扩大到整个B宿主重载过程。
- docs/PACKAGE-B-20261026.zh-CN.md 保留长素材、真实原生/音频连续性和批次恢复样本等待验收。C只读准备已记录findings，尚未写C代码。

## 2026-10-26 用户要求安全暂停

- A提交329d29d、B提交10f0614；部署仍为B面板v15。暂停只保存文件和Git检查点，不再推进实现或新运行验收。
- C4作者属性/C5指针源码已实现并有相关隔离检查；修复了独立复核发现的旧控件误写新壁纸、条件新控件禁用、未知属性默认类型被改写与延迟抬起坐标回跳。最后相关检查见暂停交接，C尚未部署。
- 当前自有宿主PID19556、主/分离页均ready且无报告错误（暂停前只读确认）；保留其正常运行，不停壁纸、不重启Codex。所有子代理已完成，无继续任务。
- C2虚拟资源URL候选在复制当前Codex CSP的隔离试验中被connect-src拒绝，拦截请求数0；没有放宽CSP或开放Web通道。C3/D/E和真实场景属性/输入视觉验收仍未完成。
- 续接入口 docs/PAUSED-20261026.zh-CN.md。不得凭旧计划自动恢复，等用户明确继续。

## 2026-10-27 恢复执行 C

用户明确继续；从干净ab1aa58恢复，保留暂停后新增库记录与当前选择。C指针控件起拖越界问题已修，属性/隔离WebGL/面板定向通过，真实AMD工坊隐藏候选检查通过。C九文件备份部署v16，当前配置全部字段一致、Codex未重启。C2/C3与可见作者效果边界见docs/PACKAGE-C-20261027.zh-CN.md。

## 2026-10-27 D源码阶段

D指标口径/GPU独立高刷/4K R=1/128条目且512MiB有界缓存已实现，相关12项和面板检查通过。真实工坊在隔离AMD Chromium对照发现并证明小资源误淘汰；大包冷读仍7秒级，不宣称普遍提速。源码阶段提交后继续E，再联合部署，当前客户端仍C/v16。

## 2026-10-27 E源码与C3字体

E轮播逻辑分组、GPU/原版保存引用、坏项跳过/保存与恢复失败停止、manual ticket优先已实施并复核；4项单元、隔离真实宿主自动/手动竞态、已有端到端及生命周期通过。完整备份补上customDisplay副本，往返/遗漏拒绝通过。C3实际CSP字体根因已复现并用固定引擎内存FontFace二进制适配修复，原件/CSP不变；真实隐藏文字场景和隔离回归通过，crop指针反算也通过。D/E将联合部署；30分钟临时资源采样仍进行，不预判结果。

## 2026-10-27 联合部署与采样结束

本轮代码提交7594a87、0da85d0、94b5b3d，均未推送。D/E与C3联合备份部署，宿主45344→53176，主/分离v18，34运行模块哈希一致，配置字节及browser identity保留。维护CLI以新文件补入并只读诊断9条无缺失。1804.64秒/58次主采样与53次GPU采样完成，诊断退出；private commit增长未完全归因，真实客户端系统/视觉/音频及Web边界见E记录。
