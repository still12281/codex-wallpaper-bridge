# DSH feature reuse into Codex

Authorized 2026-10-24. Baseline: 1c1036e. Preserve the official client and the existing Codex bridge. Commit reviewed milestones locally; do not push.

## Phases
- [x] Latest steering: resize the existing embedded wallpaper settings panel. User canceled the independent-window proposal; do not create a separate window.
- [x] Read current runtime, clean Git state and completed startup commits; other implementation chat is idle.
- [x] Prove sandboxed WebWallGL Scene in isolated Chromium and native Codex. Web resource/script loading is a separate pending gate; native capture remains available.
- [x] Integrate the proven Scene renderer behind an explicit choice with candidate adoption, failure recovery and save-only imports (8ed012c).
- [x] Reuse upstream library filtering, add rotation and portable appearance presets; synthetic UI flow and native library audit accepted.
- [x] Reuse optional glass/font/effects/parallax through Codex mappings; native settings panel reviewed after deployment.
- [x] Assess music and pet host contracts; implement only supported paths and document concrete remaining boundaries.
- [x] Review changes, meaningful tests, release allowlist, runtime deployment and separate Git commits.

## Acceptance
- Synthetic browser results and native Codex results are distinct.
- No workshop assets, runtime profiles or private configuration in Git.
- Renderer success requires actual frame evidence; failure preserves the previous background.
- No CSP bypass or client package mutation. Scene scripts remain in an opaque sandbox.

## Findings / errors
- Existing historical blob-frame prototype already ran WebWallGL; an HTTP frame was blocked by native CSP. Reuse that finding, recheck with bounded resolution rather than rebuilding an HTTP embedding route.
- Local checkout upstream v1.4.0 is two README-only commits behind the previously checked main.
- Source paths guessed as renderer/lib.ts and node_modules/webwallgl did not exist. Actual API is renderer/src/api and the prepared global bundle is available in the earlier scene probe.

## Final acceptance, 2026-10-24
- Installed embedded panel: real mouse resize 440x780 to 504x700, close/reopen persistence, reset and metadata-only opt-in/off accepted; original wallpaper/media configuration restored.
- Installed library: 88 compatible items, 24-card page, loaded previews, save-only WebGL reference, scene application and return to prior video; no leftover WebGL or pending media layers.
- 18 unit tests, isolated browser UI flow and isolated WebGL lifecycle/spectrum attach-detach passed. Native WASAPI fresh-frame delivery accepted; silent sample means nonzero music visualization remains unverified.
- Remaining boundaries are documented: WebGL Web resource/script channel, official pet choreography API and general/fresh-machine compatibility. No independent settings window was created.

## Follow-up authorized
- [x] My-library thumbnail preview and explicit apply/delete; selected import inspection visible beside preview.
- [x] Checked-item batch save with counts/results and duplicate dialogs including uploaded-file content hashing.
- [x] Real nonzero spectrum/visual acceptance passed. Player-control assessment completed with a partial failure on Windows current-session switching; exact-session recovery restored original playback. Identity/readback guards added; pinned-session controls remain a limitation.
- [x] Inspect upstream startup effects only; no pet work.
## 2026-10-25: Display tiers and visible regression
- [x] Diagnose white geometry / black unreadable error dialog from supplied screenshots against current runtime.
- [x] Fix confirmed regressions without removing high-end features or touching the official client.
- [x] Integrate real static, economical, balanced, quality and full-feature choices with advanced controls and honest renderer boundaries.
- [x] Validate rollback, audio/focus preferences, genuine static resource stop, runtime UI and selected scene.
- [x] Only after those stages, assess native-engine rendering with bounded impact; do not claim fidelity/performance before actual proof.

## 2026-10-25: Reopened-client and display regressions
- [x] Diagnose real taskbar activation versus the wallpaper entry; preserve the running client.
- [x] Exercise the original scene in isolated software/default and AMD D3D11 contexts; reject critical effect failures rather than adopting a broken candidate. The original polygon trigger did not reproduce and remains unconfirmed.
- [x] Preserve paused wallpaper frames; make theme/glass choices explicit; correct panel spacing and dropdown contrast.
- [x] Expose and explain actual quality budgets without implying renderer compatibility.
- [x] Validate targeted regressions, deploy and prepare the independent-identity single entry.
- [ ] Native cold launch, actual pin identity/grouping, original white-polygon and blur-preservation visual acceptance require the user to exit the current ordinary client and reopen the prepared entry. No native completion claim.

## 2026-10-25：最高档接近桌面 Wallpaper Engine 的执行计划（当前优先）

本节取代上面旧的执行顺序。用户本轮要求列计划、减少不重要的测试、重要阶段提交 Git；本轮只落地计划，不开始渲染实现。最高档先接近桌面原版的画面、特效、脚本、音频响应、清晰度和流畅度，再做其余收尾。

### 路线与完成标准

- 主路线：Wallpaper Engine 原生引擎在本项目拥有的专用窗口运行完整场景，经窗口采集接入 Codex。复用原版场景、字体、粒子、脚本和音频处理；WebGL 保留为替代路线，视频层保留为轻量选择。
- 当前传输是 WGC → JPEG（品质 78）→ Node/CDP → canvas，并非 GPU 画面直接嵌入。最高档不能只是提高 WebGL 参数，也不能承诺与桌面零差异；压缩、采集、解码和合成延迟须实测。
- 对照以工坊 3600630828 为首个样本，核对桌面项目属性、构图/比例、字体、脚本、音频条、源帧率及输出尺寸。桌面全局配置保持原样；单独检查专用窗口是否继承了这些属性。
- 验收分开报告：效果完整性、音频响应、实际绘制 FPS/掉帧、清晰度、端到端延迟、总 CPU/GPU/内存、暂停恢复、用户感知。源端帧数与设置上限不能代替 Codex 实际显示。
- 工程目标：先匹配桌面当前实际源帧率；稳定段有效输出争取不低于源帧率的 90%，采集至显示延迟争取 P95 ≤ 100ms。这是待验证的目标，不是当前成绩；源端不足 60FPS 时不承诺 60FPS。记录测量误差与达不到的原因，不以静默去特效通过验收。

### 阶段 0：保留现场与建立可回退基线

- [ ] 分类审查现有未提交改动，将显示档位/保帧、启动/图标、音乐等按实际依赖形成可用提交；不把未经审查的代码当成已验收版本。
- [ ] 在仓库外保留当前设置与部署备份；记下选中项、素材引用、官方图标和原生引擎桌面状态。
- [ ] 修复多窗口 runtime-status.targets 被最后一个窗口覆盖的问题，保留各目标的身份、就绪/暂停、实际帧状态和错误，为后续测量提供可靠依据。
- 提交：分别保存已审查的历史阶段；再提交基线/多窗口状态修复。

### 阶段 1：先让最高档运行完整原生场景

- [ ] 用已有原生专用窗口采集链路接入真实 Codex，复用现有确认、候选就绪、失败回退机制；不重新造一个渲染引擎。
- [ ] 对照首个样本的原版音频条、字体、时钟/文本、脚本、粒子、特效、裁切和自定义属性。确认音频来自 Wallpaper Engine 原生处理，避免同时运行多余的 WebGL 频谱采集。
- [ ] UI 明示“视频层 / WebGL / 原生完整场景”、当前效果缺口和音频来源。最高档与完整原生路线关联，并保留确认与已保存偏好，不让旧视频层被误认为完整最高档。
- [ ] 验收一次真实播放、暂停/恢复和返回原背景；原始白块、保帧及模糊同步一并检查。未复现原白块时继续标为触发原因未知。
- 提交：原生最高档接入与必要的状态/UI 修正。记录本样本已通过与未通过的项目。

### 阶段 2：集中解决流畅度、清晰度和音画延迟

- [ ] 先做一次短对照，将源渲染、采集编码、传输、解码绘制分段计时；统计 Codex 实际更新和丢帧，采样包含原生源、Python、Node、Codex 渲染与 GPU 的总成本。
- [ ] 按真实瓶颈优化分辨率/比例、JPEG 品质、帧率、队列与旧帧丢弃、重复编码或复制、CDP 传输及画布绘制；不靠移除特效或关闭原版音频响应达标。
- [ ] 若 JPEG/CDP 是决定性瓶颈，只做一次有界替代传输试验，评估编码视频流或原生 GPU 共享/合成的可行性、CSP/宿主限制和收益，再决定是否接入。不先承诺零拷贝或扩建复杂框架。
- [ ] 高档验收后再安排一次约 15 分钟稳定运行，观察停帧、内存增长、音频漂移、白块和源窗口泄漏；实现没有变化时不重复同一组检查。
- 提交：按实际可独立回退的性能改进分阶段提交；证据标明环境、桌面对照与剩余差距。

### 阶段 3：把容易遗漏的交互与可靠性补齐

- [ ] 原生采集当前没有鼠标转发。评估用户常用场景的鼠标效果；仅在可保持 Codex 输入正常、只操作自有源窗口时接入。做不到则公开最高档的交互差距，不声称各方面等同。
- [ ] 验证失败候选不替换旧背景、运行中源故障能回退，切换/退出后本项目源窗口和助手退出；失焦暂停不能冒充原生源 GPU 停止。
- [ ] 合并检查多窗口、最小化/恢复、睡眠唤醒、尺寸变化和普通启动/壁纸入口切换。涉及退出当前 Codex 的步骤留给用户正常退出，不强关或自行重启。
- [ ] 核实实际任务栏固定项、原版图标、单图标分组和一次真实冷启动；把已成功启动的记录与未验收的分组显示分开更新。
- [ ] 补齐完整配置/库引用备份恢复、素材移动后的重新定位、损坏配置恢复，以及停用/卸载与缓存空间说明。外观预设导出不能充当完整库备份；不删除外部原素材。
- [ ] 音乐多播放器控制单独修复会话锁定或明确限制，不阻塞原生壁纸音频响应；不为测试擅自改变实际播放器队列。
- 提交：按可靠性、备份恢复、入口/任务栏等可独立回退的阶段提交。

### 阶段 4：文档与版本收尾

- [ ] 统一 README、SECURITY、REALTIME、功能状态、发布清单和当前计划；纠正“场景脚本不执行”“自动优先视频层”“Git 未初始化”等过时说法。更新原生启动证据，不覆盖仍未知的验收项。
- [ ] 说明三条路线的效果、音频、交互、性能和依赖边界；保留低档及用户原有选择，不将最高档自动设为默认。
- [ ] 完成一次必要的最终检查，更新发布清单并整理本地提交和验收结论。公开仓库、署名/许可证确认、推送和发布另行授权。
- [ ] 后置：WebGL 网页通道、启动动画、更多特效及新机器兼容性。桌宠仍排除；这些不阻塞最高档首个样本验收。
- 提交：文档、版本清单和验证状态收尾；不自动推送。

### 精简验证与 Git 纪律

- 文档/计划修改不跑渲染与全套业务测试；只检查差异、内容和受影响的发布清单。
- 每次实现只保留直接覆盖实际风险的定向测试；关键阶段各做一次真实 Codex 验收。已有检查通过后，仅因相关代码变化、失败或矛盾重跑。
- 必保留：原生首帧和完整效果、真实音频响应、FPS/延迟/总成本、失败回退与清理、设置保留。界面布局小修不新增镜像实现的单测；不对每种档位/尺寸/GPU 做排列组合。
- 最后只做一次相关单测集合与发布/隐私检查；隔离浏览器仅在真实问题需要隔离时使用，不重复证明已通过的接口存在。
- 每个重要阶段审查 diff，仅暂存属于该阶段的明确文件；提交后报告哈希、关键验证和未知项。配置、素材、原始画面、聊天、日志和大型产物留在 Git 外。
