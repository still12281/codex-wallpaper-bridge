# 当前执行计划入口（2026-10-26）

## 当前授权：面向新用户的安装与README（2026-10-28）

- [x] 核对构建/快捷方式/运行时与可选组件脚本：现有入口需手动执行多步，尚无双击安装器；运行路径绑定源码目录，需安装副本。
- [x] 补Install.cmd与PowerShell7安装器：按需准备Node/PowerShell/FFmpeg/uv，校验GPU与锁定采集依赖，部署到按清单哈希区分的版本目录并创建一体入口；不启动/关闭当前Codex，不覆盖设置，不自动启用更新任务。记录FFmpeg/uv绝对路径，支持桌面空PATH启动。
- [x] 定向验证3项安装源/3项图片边界测试、可选运行时路径、CMD只检查、独立目录实际下载准备/编译/快捷方式、重复安装和原生空PATH入口检查。路径围栏发现Windows长短路径差异后修正；快捷方式比较统一路径分隔符。不运行WinGet修改现有基础依赖，不声称全新Windows安装或冷启播放已验证。
- [x] README按新用户顺序写清一键安装、首次启动、导入、配置入口和具体优势；完整中文安装指南包含自定义盘、依赖/可选音乐/更新任务、故障、升级和卸载，英文同步。不在README列未实现/待验收条目；发布检查后本地提交，不推送。

## 当前授权：多角度演示实拍与中文README（2026-10-28）

- [x] 盘点真实未完成项，参考DSH/Lively README的效果、功能、安装与限制顺序，不复制第三方素材、文案或发布统计。
- [x] 用户随后明确改为真实桌面端：打开未提交的新对话，收起/隐藏两侧内容及账号/项目/路径/权限字段；仅截应用视口和面板，不截桌面或其它程序。图库使用新生成素材，私人库未增删。
- [x] 11张实拍覆盖深浅主题、壁纸库/导入/批量、画质、外观、作者属性、轮播/预设、音乐联动及窄窗；逐图查看。发现轮播收藏名后隐藏重拍，歌曲状态/路径不公开；结束移除临时样式、返回原聊天，13条库及设置文件哈希恢复一致，未重启Codex。
- [x] 仅将11张已审查PNG逐项加入二进制白名单与原始字节哈希，拒绝元数据/尾随内容/未审查图片；3项发布图片边界测试、文件/第三方哈希检查通过。中文README/截图索引/剩余清单已更新，按本地阶段提交，不推送；这轮不改播放代码、不重跑全套播放测试。

本次“可以做截图”更新了上一阶段仅不截图的限制；“就在桌面端，以新对话为背景”进一步更新了原隔离环境方案，允许为截图操作客户端导航/侧栏和面板。仍不捕获真实聊天/账号、不关闭或重启当前Codex。截图中的第三方壁纸不随代码许可授权，也不分发其原文件。

## 当前授权：控制面板样式整理（2026-10-28）

- [x] 读取用户指定awesome-design-md README、Linear/Raycast设计分析和MIT说明；GitHub连接工具可用，未重试已失效的本机gh凭据。
- [x] 将分层表面、单一强调色、统一间距和36px控件适配到现有Shadow DOM面板；批量保存/完成回归次级，预览、筛选、卡片及高级设置统一，保留中文/壁纸取色/明暗主题和全部操作。
- [x] 无截图的隔离DOM/样式/布局/交互通过，360/640/宽面板无横向溢出或可见控件交叠；备份部署v23，13条库/配置/一体入口及Codex保持。仅替换自有宿主，无依赖/监控/CSP改动，见[样式记录](docs/UI-DESIGN-20261028.zh-CN.md)。
- [x] 记录未来实图的真实运行/隔离演示/去个人信息边界；本轮截图数0，未调用截图或录屏接口。

## 当前授权：无损性能优化与GitHub发布准备（2026-10-28）

- [x] 优化导入/应用重复I/O：64条版本验证指纹、64条/8MiB预览复用；保持首次完整指纹、源变化拒绝与取消/回滚。
- [x] 优化临时资源/重复通信：File-backed缓存响应、先交付后有界落盘、及时释放引用；音乐活动桥及嵌入页减少重复安装/绘制，不降画质/帧率。
- [x] 定向及76项单元、同样本对照与备份部署；212MB隐藏候选1478→870ms，采样backing峰值249.4→47.0MiB；设置/13条库/一体入口和官方Codex保留，无监控。源码提交50e9e22，见[性能记录](docs/PERFORMANCE-20261028.zh-CN.md)。
- [x] 检查GitHub源码发布的隐私/许可证/安装说明/文件清单；中文根README、独立英文版、截图清单和明确限制已整理，不推送或创建远端。
- [ ] 用户新增任务栏唤回：原生恢复/前台读回及精确主窗口匹配已部署，策略/只读验收通过；用户真实点击、隐藏/最小化及跨DPI仍待验收。见[任务栏记录](docs/TASKBAR-REOPEN-20261028.zh-CN.md)。
- [ ] 实际发布：本机gh凭据失效，仓库归属/名称/公开署名/MIT确认和脱敏演示图仍待补；可准备源码alpha，不称所有原生兼容已完成。

两项只读审查均请求GPT-6.1 Sol/high，均因模型容量不足中止，由主代理接管完成，未换模型重试或将其记为已完成复核。用户此前“只回答不改动”已由本次明确选择“优化这些”更新；本轮范围不含修改官方包、CSP或关闭官方附属页面。

最新续接（2026-10-28 启动内存现场）：用户从一体入口正常启动26.1023后，实测ChatGPT.exe合计私有工作集约2.06–2.08GiB；主要为聊天renderer约603–634MiB、GPU约512–562MiB、方案页及隐藏avatar页合计约441–445MiB。两个壁纸沙箱共用renderer约48–51MiB，Node宿主RSS约63MiB，不能把整个GPU占用算作壁纸增量。仅一个客户端根/一个壁纸宿主，更新事件任务从未运行；设置SHA保持fe1bb3…903ee。未取得同条件旧版基线，不能确认翻倍幅度或断言无泄漏；GPU具体分配归因仍待补，见[E现场记录](docs/PACKAGE-E-20261027.zh-CN.md)。本轮只读诊断，无重启/关页/强制GC/生产改动。

内存补充：用户明确是Codex总占用由不到1GB涨到近2GB，应按显著增量排查。原详细转储缺失经有限流式读取补齐，主聊天V8约319MiB、隐藏avatar V8约123MiB；GPU malloc/gpu/Skia分配标签已取得，但不能相加或归为壁纸独占。临时诊断初版解析触及自身128MiB限制，修正分块缓冲、离线核对后同限完成；Codex未退出。仍缺旧版本/壁纸增量对照，不宣布涨幅原因已定位或已修复。

最新续接（更新后单次重连）：用户已授权仅更新后尝试一次正常关闭/重连，不强制结束，不常驻。Windows事件任务已安装为Ready，基线26.1023/事件78483；只处理之后的新版本注册完成事件，旧事件78396经实际一体入口回放被拒绝，当前客户端/设置字节不变、无重连进程残留。关闭失败/20秒未退出/出现新实例均停止，不重试；真实自然更新到可见恢复仍待验收，不能称为“免疫更新”。见[单次重连记录](docs/AFTER-UPDATE-RECONNECT.zh-CN.md)。

最新续接（启动自检/渲染优先）：一体入口每次均经过当前注册包/客户端/宿主检查，增加entry-health历史与旧官方快捷方式的备份修复；实际开始菜单旧26.1016入口已接回原CodexEntry。实际native entry在空PATH下识别26.1023检查通过，未重启当前客户端；13条库/选中项保留，只增加rendererPriority（场景GPU、网页原版）。Windows包更新的ARR空参数直接重开绕过入口，当前约束下不能保证自动接回，未勾选完全解决。见[本轮记录](docs/STARTUP-UPDATE-20261027.zh-CN.md)。

最新续接（2026-10-27 Web）：已完成可选“网页浏览器（试验）”通道，复用 DSH 相对资源/路径围栏与 WebWallGL Web shim，独立无窗口 Chromium → 调试管道 JPEG → 现有画布。场景自动 GPU 路由不变；原版 Web 记录不迁移。暂停关闭专用浏览器，恢复重载；静态页无帧不误报；详见 [网页实施记录](docs/BROWSER-WEB-20261027.zh-CN.md)。当前客户端已变为26.1023且9335未监听、自有宿主已退出，源码部署与配置保留可核验，真实新客户端采用/呈现留待用户正常从一体入口启动，绝不强关重启。

当前续接：已从侧边聊天定位到引导横栏材质遗漏及GPU/WebGL名称疑问，六模块部署v20，38模块/13条库和配置保留；当前终端版本精确映射已补，分离页无terminal模块保留原生后备。见 [本轮记录](docs/STEERING-WEB-20261027.zh-CN.md)。无窗口网页采集的有界试验进行中，不预判正式Web功能完成。

最新续接：导入状态筛选与按钮间距已部署v19，本地提交51cf20a；随后视频File-backed Blob/流式准备及本机选择器已部署，38模块一致、13条库及配置字节保留，详见 [大视频记录](docs/LARGE-MEDIA-20261027.zh-CN.md)。分离页ready；主页面隐藏时按既有逻辑等待可见再装配，未强制前置。2.4GB稀疏容器验证不冒充真实几GB编码素材验收；巨大GPU场景包和独立网页渲染器仍待实现。

完整计划见 [壁纸项目完整执行计划](docs/EXECUTION-PLAN-20261026.zh-CN.md)：T01—T14 全部映射到 A 界面、B 导入、C DSH/GPU 兼容、D 帧率与切换、E 生命周期与收尾五个执行包。

状态：本轮从干净42bd3fb续接，先核对C/E记录、Git和部署。Web通用路线保留原版WE专用窗口采集，GPU Web仍禁用；大场景绕过Base64重传的安全文件读取已部署，212MB样本真实Codex隐藏候选从6.92秒降至最终约1.60秒（主）/1.32秒（分离）。37个src模块与部署一致，9条库、配置字节、官方客户端和一体入口保留。内存归因已确认部分资源可回收、无三次节点/监听累积，browser进程增长仍未完全解释；临时诊断全部退出，详见 [本轮记录](docs/FOLLOWUP-20261027.zh-CN.md)。提速本地提交19d326e，整体计划未全部验收，“先预览、确定切换”保留。

## 执行包 A（已实施，部分真实验收待补）

- [x] 读取完整计划、当前 Git（main / 052338f，工作区干净）及直接相关实现。
- [ ] A1 已接入实际引用栏和语义浮层/主题变量；当前未打开的原截图引用浮层/额度卡片仍待真实视觉验收。
- [x] A2 容器响应式、滚动与窗口尺寸；取消遮挡内容的 sticky 预览；代表布局隔离通过。
- [x] A3 单项应用/保存与单一批量保存入口；保留预览后确认；隔离实际处理函数通过。
- [x] A4 轻量组件规范与状态；比较 Fluent / shadcn / DSH，保留 Shadow DOM；焦点/忙碌与主题检查通过。
- [x] 代表尺寸/主题/缩放检查、部署备份及当前客户端 UI 热更新；设置字节、渲染器/媒体层和几何记录保持一致。

详见 [A 实施与验收边界](docs/PACKAGE-A-20261026.zh-CN.md)。源码/部署已更新，真实浮层视觉和宿主动作往返尚待补，未宣称 A 全部验收。B 开始先核实空 runtime-status/缺失旧宿主，不因页内背景 ready 推断后端健康。

## 执行包 B（进行中）

- [x] 恢复原有失联宿主（不重启 Codex）；只读请求回读恢复，当前选择与全部配置字段一致。旧退出原因无日志，仍未知。
- [x] 新输出使用独立最终路径；保存失败不覆盖旧字节、不遗留已改名新输出；保留 customDisplay 引用。
- [x] 加入实际媒体探测/空间/源版本检查、容量风险预先确认与运行中大小保护；损坏上传失败清理。
- [x] 兼容图片/无声 MP4 直接复制、有声兼容 MP4 去音轨封装，其余转码；合成 8 秒样本 1551ms → 72ms（限定该样本，不是所有导入）。
- [x] 实施进度/取消、失败项重试、单任务队列与有界转换结果复用；隔离真实宿主的正在转换/排队取消通过。
- [x] 定向集成、部署、当前客户端上传取消/仅保存往返；全部配置字段保持一致。
- [x] 补测生成1800秒/约76MiB文件的预检/指纹/快速准备/提交与大文件哈希取消；限定样本总约260ms，不包含真实上传/应用，不虚构旧全量转码对照。
- [ ] 真实容量触顶、原生/音频长导入连续性和真实批次恢复样本仍待补，不宣称B全部验收。

B 实施详情见 [媒体准备与事务](docs/PACKAGE-B-20261026.zh-CN.md)。A本地提交329d29d；B实现单独提交。接续C优先属性/输入，Web资源通道需有界可行性检查；不整体升级引擎。

## 执行包 C（C4/C5已部署，兼容缺口保留）

- [x] C1/C3 上游能力三列核对与许可证/版本只读核实，未整体升级。
- [x] C4 首批 bool/color/slider/combo 作者属性UI、逻辑壁纸覆盖持久化、默认恢复、隐藏属性默认值及GPU初始/热更新；定向单元与隔离WebGL回读通过。
- [x] C5 被动指针释放、取消/离开/失焦、修饰键与快速点击保持；排除聊天输入、控件/文本选择；隔离事件与监听清理通过。
- [x] C4/C5 复核并修复控件起拖越界问题，备份部署v16；实际AMD/工坊隐藏候选属性/像素/清理检查通过，配置字段一致。见 [C记录](docs/PACKAGE-C-20261027.zh-CN.md)。
- [ ] C4/C5 真实可见场景属性/指针效果验收；隐藏候选回读不替代可见验收。
- [x] C2独立 Chromium Web 相对资源/脚本可行性与有界生命周期检查；已接入显式试验入口，不改官方 CSP。原有 GPU Web 嵌入仍禁用；不是所有网页兼容或真实可见呈现验收，见网页实施记录。
- [x] C2安全路线裁决：通用Web复用原版专用窗口采集；字节broker不等于浏览器虚拟目录，保留GPU Web禁用，不把路线审查当Web功能完成。
- [ ] C3 字体/粒子/模型/脚本/效果的实际样本差异和真实音频复核；不能由空场景API回读代替。
- [x] C3 内嵌字体改用上游已校验的二进制输入，真实Codex隐藏文字场景加载/像素通过；安装引擎原件和CSP不变。cover裁切指针反算已补，隔离事件检查通过。

## 执行包 D（已部署，真实呈现边界保留）

- [x] D1 真实口径与静态/暂停、D2 GPU独立高刷与4K纹理预算、D3 小资源误淘汰修复及冷/暖/清理/大包/源变更对照；详见 [D记录](docs/PACKAGE-D-20261027.zh-CN.md)。
- [x] 联合部署v18，主/分离页均ready，真实只读RPC/当前项重选约4.6ms，配置字节相同。
- [x] D3大包资源缓存未命中提速：validated file → detached input/FileReader →原有缓存/字节沙箱，保留协议缺失后备、源变化围栏和及时取消。最终真实隐藏候选主/分离1.60/1.32秒；可见全程及OS冷盘仍未验收。
- [ ] 当前客户端稳定60/高刷可见输出与主/分离窗口完整切换耗时；隔离提交率不冒充真实屏幕呈现。

## 执行包 E（已部署，系统和资源边界保留）

- [x] 逻辑项目轮播、旧ID兼容、坏项跳过/保存与恢复失败停止、后台等待、手动ticket优先；隔离真实宿主竞态通过。
- [x] 备份/恢复/诊断补齐customDisplay副本，源CLI及运行目录CLI可用；T01—T14状态同步。
- [x] 1804.64秒临时隔离采样结束，58次无帧错误，GPU另53次；临时进程退出，无常驻监控。
- [ ] private commit早/末段约497→533MiB，增长未完全归因；真实Codex增量/并排窗口/音频长期漂移仍待定向检查，不宣称无泄漏。
- [x] 追加进程角色/JS heap/backing/DOM/监听定向归因：场景资源与GPU进程主要装配内存可回收，三次销毁无节点/监听累积；browser进程增长尚未定位，不勾选整体无泄漏。
- [ ] E1冷启/任务栏/正常退出/睡眠需用户正常操作；媒体同App精确会话、新机器/版本兼容仍未完成。E5额外片头经评估不实施，现有特效偏好保留。

# DSH feature reuse into Codex（历史记录）

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

本节取代上面旧的执行顺序。用户本轮要求列计划、减少不重要的测试、重要阶段提交 Git；该轮只落地计划；2026-10-26 用户已明确授权执行。最高档先接近桌面原版的画面、特效、脚本、音频响应、清晰度和流畅度，再做其余收尾。

### 路线与完成标准

- 主路线：Wallpaper Engine 原生引擎在本项目拥有的专用窗口运行完整场景，经窗口采集接入 Codex。复用原版场景、字体、粒子、脚本和音频处理；WebGL 保留为替代路线，视频层保留为轻量选择。
- 当前传输是 WGC → JPEG（品质 78）→ Node/CDP → canvas，并非 GPU 画面直接嵌入。最高档不能只是提高 WebGL 参数，也不能承诺与桌面零差异；压缩、采集、解码和合成延迟须实测。
- 对照以工坊 3600630828 为首个样本，核对桌面项目属性、构图/比例、字体、脚本、音频条、源帧率及输出尺寸。桌面全局配置保持原样；单独检查专用窗口是否继承了这些属性。
- 验收分开报告：效果完整性、音频响应、实际绘制 FPS/掉帧、清晰度、端到端延迟、总 CPU/GPU/内存、暂停恢复、用户感知。源端帧数与设置上限不能代替 Codex 实际显示。
- 工程目标：先匹配桌面当前实际源帧率；稳定段有效输出争取不低于源帧率的 90%，采集至显示延迟争取 P95 ≤ 100ms。这是待验证的目标，不是当前成绩；源端不足 60FPS 时不承诺 60FPS。记录测量误差与达不到的原因，不以静默去特效通过验收。

### 阶段 0：保留现场与建立可回退基线

- [x] 分类审查现有未提交改动，将显示档位/保帧、启动/图标、音乐等按实际依赖形成可用提交；不把未经审查的代码当成已验收版本。
- [x] 在仓库外保留当前设置与部署备份；记下选中项、素材引用、官方图标和原生引擎桌面状态。
- [x] 修复多窗口 runtime-status.targets 被最后一个窗口覆盖的问题，保留各目标的身份、就绪/暂停、实际帧状态和错误，为后续测量提供可靠依据。
- 提交：分别保存已审查的历史阶段；再提交基线/多窗口状态修复。

### 阶段 1：先让最高档运行完整原生场景

- [x] 用已有原生专用窗口采集链路接入真实 Codex，复用现有确认、候选就绪、失败回退机制；不重新造一个渲染引擎。
- [x] 对照首个样本的原版音频条、字体、时钟/文本、脚本、粒子、特效、裁切和自定义属性。确认音频来自 Wallpaper Engine 原生处理，避免同时运行多余的 WebGL 频谱采集。
- [x] UI 明示“视频层 / WebGL / 原生完整场景”、当前效果缺口和音频来源。最高档与完整原生路线关联，并保留确认与已保存偏好，不让旧视频层被误认为完整最高档。
- [x] 验收一次真实播放、暂停/恢复和返回原背景；原始白块、保帧及模糊同步一并检查。未复现原白块时继续标为触发原因未知。
- 提交：原生最高档接入与必要的状态/UI 修正。记录本样本已通过与未通过的项目。

### 阶段 2：集中解决流畅度、清晰度和音画延迟

- [x] 先做一次短对照，将源渲染、采集编码、传输、解码绘制分段计时；统计 Codex 实际更新和丢帧，采样包含原生源、Python、Node、Codex 渲染与 GPU 的总成本。
- [x] 按真实瓶颈优化分辨率/比例、JPEG 品质、帧率、队列与旧帧丢弃、重复编码或复制、CDP 传输及画布绘制；不靠移除特效或关闭原版音频响应达标。
- [ ] 若 JPEG/CDP 是决定性瓶颈，只做一次有界替代传输试验，评估编码视频流或原生 GPU 共享/合成的可行性、CSP/宿主限制和收益，再决定是否接入。不先承诺零拷贝或扩建复杂框架。
- [x] 高档验收后再安排一次约 15 分钟稳定运行，观察停帧、内存增长、音频漂移、白块和源窗口泄漏；实现没有变化时不重复同一组检查。
- 提交：按实际可独立回退的性能改进分阶段提交；证据标明环境、桌面对照与剩余差距。

### 阶段 3：把容易遗漏的交互与可靠性补齐

- [x] 原生采集当前没有鼠标转发。评估用户常用场景的鼠标效果；仅在可保持 Codex 输入正常、只操作自有源窗口时接入。做不到则公开最高档的交互差距，不声称各方面等同。
- [x] 验证失败候选不替换旧背景、运行中源故障能回退，切换/源故障后本项目源窗口和助手退出；失焦暂停不能冒充原生源 GPU 停止。
- [ ] 合并检查多窗口、最小化/恢复、睡眠唤醒、尺寸变化和普通启动/壁纸入口切换。涉及退出当前 Codex 的步骤留给用户正常退出，不强关或自行重启。
- [ ] 核实实际任务栏固定项、原版图标、单图标分组和一次真实冷启动；把已成功启动的记录与未验收的分组显示分开更新。
- [x] 补齐完整配置/库引用备份恢复、素材移动后的重新定位、损坏配置恢复，以及停用/卸载与缓存空间说明。外观预设导出不能充当完整库备份；不删除外部原素材。
- [x] 音乐多播放器控制单独修复会话锁定或明确限制，不阻塞原生壁纸音频响应；不为测试擅自改变实际播放器队列。
- 提交：按可靠性、备份恢复、入口/任务栏等可独立回退的阶段提交。

### 阶段 4：文档与版本收尾

- [x] 统一 README、SECURITY、REALTIME、功能状态、发布清单和当前计划；纠正“场景脚本不执行”“自动优先视频层”“Git 未初始化”等过时说法。更新原生启动证据，不覆盖仍未知的验收项。
- [x] 说明三条路线的效果、音频、交互、性能和依赖边界；保留低档及用户原有选择，不将最高档自动设为默认。
- [x] 完成必要的定向检查，更新发布清单并整理本地提交和验收结论。公开仓库、署名/许可证确认、推送和发布另行授权。
- [ ] 后置：WebGL 网页通道、启动动画、更多特效及新机器兼容性。桌宠仍排除；这些不阻塞最高档首个样本验收。
- 提交：文档、版本清单和验证状态收尾；不自动推送。

### 精简验证与 Git 纪律

- 文档/计划修改不跑渲染与全套业务测试；只检查差异、内容和受影响的发布清单。
- 每次实现只保留直接覆盖实际风险的定向测试；关键阶段各做一次真实 Codex 验收。已有检查通过后，仅因相关代码变化、失败或矛盾重跑。
- 必保留：原生首帧和完整效果、真实音频响应、FPS/延迟/总成本、失败回退与清理、设置保留。界面布局小修不新增镜像实现的单测；不对每种档位/尺寸/GPU 做排列组合。
- 最后只做一次相关单测集合与发布/隐私检查；隔离浏览器仅在真实问题需要隔离时使用，不重复证明已通过的接口存在。
- 每个重要阶段审查 diff，仅暂存属于该阶段的明确文件；提交后报告哈希、关键验证和未知项。配置、素材、原始画面、聊天、日志和大型产物留在 Git 外。


## 2026-10-26 执行记录与保留边界

- 已提交显示/保帧基线 5f1cb5b、入口/图标与安全重连 813eb91、多窗口状态/候选源清理 fa98a9e、原生最高档与有界采集 b23ea8b、私有库备份恢复 1605d79。全部为本地提交，未推送。
- 首个真实 Codex 样本已运行完整原生场景，1920×1320、桌面配置 30 FPS、JPEG 92。短测 27.07 次画布更新/秒，采集回调至绘制 P95 90.76ms；这不是物理呈现或音画端到端延迟。
- 旧背景保留的坏 JPEG 检查通过；500ms 慢窗口检查中主窗口 27.77 次/秒、慢窗口 3.49 次/秒。低音量自有音频样本触发原版环形音频条，未操作用户播放器。
- 性能根因：三通道 NumPy 非连续视图使 JPEG 编码变慢；连续 BGRA 在同一帧上字节一致而编码中位耗时从约 18ms 降到 6ms。当前没有证据需要为此样本替换整个 JPEG/CDP 传输，不扩建 GPU 共享框架。
- 原生最高档稳定性采样为一次固定 15 分钟诊断，无新增常驻监控；运行中临时绕过失焦暂停，结束恢复保存偏好。最终结果另记，不提前勾选完成。
- 完整库 7 条记录/9 个文件独立恢复通过；恢复拒绝覆盖、损坏和路径逃逸，测试发现并修复 Windows 短路径归一化问题。普通外部媒体暂用重新导入，原生/WebGL 项目支持离线重定位。
- CPU/内存和 GPU 按完整进程组采样，包含原有桌面场景及 Codex 工作负载；不把组内约 4GiB/短时约18% CPU 说成壁纸增量，也不把各 GPU 引擎相加。
- 原生鼠标转发、任务栏实际视觉分组、睡眠唤醒/真正冷启动及跨版本/新机器仍未验收。当前客户端始终保留。原白块触发原因仍未知；当前原生样本没有复现不等于修复原 WebGL 触发条件。


### 本轮最终验收

- 15 分钟实测已结束：905.84 秒、平均 27.30 次画布更新/秒、采集回调到绘制 P95 88.81ms；181 个采样无目标错误、无连续停帧。该段包含有界慢窗口与低音量自有音频诊断，未保存连续画面。
- 堆使用首/中/末分钟中位数约 10.5/10.4/11.1 MiB；RSS 波动，末分钟中位数约 99 MiB。不能仅凭本轮有限时长断言长期无泄漏或所有音画漂移条件均已覆盖。
- 定向关闭唯一命名的自有源窗口后，真实 Codex 自动回退到原视频，原生引用清理完成，Python 采集进程退出；官方客户端 PID/启动时间不变。随后重新启用原生最高档。
- 后续仍需用户正常退出后的冷启、任务栏视觉分组和系统睡眠唤醒；当前授权下不强关客户端、不主动让整机睡眠。原生鼠标交互及物理呈现延迟仍为明确差距。

- 最后两项边界复核已修复：高级 FPS/尺寸调整保留 JPEG 92 与已选比例；绘制超时的窗口隔离停止追加，避免 CDP 超时未取消远端解码而继续积压。实际 1900ms 延迟测试仅发送两帧后隔离，主窗口 28.04 次/秒，重新应用后恢复。新增边界修复使用定向验证，未重复整套 15 分钟采样。
- 真实客户端正常退出时的原生助手清理尚待与冷启一起验收；隔离宿主断连退出和真实源故障/切换清理已有证据。

- 末尾修复提交 875a1d8 已部署。最后短测为 28.77 次/秒、callback-to-draw P95 92.81ms；随后只做了已通过超时分支的可见错误通知补齐，使用既有弹窗，不再重复整段性能测试。当前已重新应用最高档，原视频记录与外观/音频/失焦暂停/轮播/预设/导入默认规格均保留。

## 2026-10-26 中断后续接：可用性、4K 与 DSH 对比

上一轮额度中断时的可用性修改未完成验收和提交；以下以重新核验为准。

- [x] 任务栏入口唤回已验证的同一客户端与主页面；独立提交 e90b9d1。
- [x] 固定实际 3840×2160 输出，并显示实际尺寸；档位与渲染方式分开。
- [x] 复用 DSH v1.4.0 renderer.js 控制源码与 64 段缓存频谱；比较 GPU 4K 与原生 1280/4K 路线。
- [x] 删除失焦 1.5 秒就关闭/重建原生窗口的改动，先准备采集助手，再创建并校验屏外源窗口；暂停/恢复/入口唤回保持相同 HWND。
- [x] 内嵌标准标题栏拖动、八方向缩放、最大化还原；实际指针检查发现并修复标题重组问题；长说明收进帮助。
- [x] 删除视频层提取、隐藏省电旧动作、废弃 supervisor 与对应旧测试；保留用户已保存素材。
- [x] 收尾记录最新占用、部署一致性、提交和发布清单；源码与部署一致，7 个库 ID、用户功能偏好与桌面配置保留。
- [ ] 仍需用户正常关闭主窗口后的唤回、真正冷启/睡眠唤醒、首次创建闪屏观察；不强关当前 Codex。
- [ ] 原生鼠标转发、所有第三方场景效果/字体一致性与长期 GPU 显存仍无完整验收；不因本次短测勾选完成。

- 本轮本地提交：e90b9d1（入口）、8de1969（4K/DSH/标准控制窗）、36a0db3（废弃 supervisor）；文档与清单单独收尾。最终部署为 GPU 4K/30，真实主/分离页面均 ready、无报告错误。客户端 PID/启动时间未变。

## 已导入场景切换延迟，2026-10-26

- [x] 查明保存仅存引用，原逻辑重复确认并经 CDP 重传约 212 MB 场景包。
- [x] 保存记录直接选择；健康当前项不重建，异常当前项仍允许重试。
- [x] 专用资源缓存按文件版本失效，限制总容量并提供清理入口；命中后直接向隔离页转移缓冲。
- [x] 真实 Codex 库内往返：主画面约 1.40 秒、两窗口完成约 3.03 秒；重选当前约 4ms；无额外场景传输。
- [x] 路径围栏/文件变化检查、选中项无需重导入、GPU 生命周期/音频/失败保留和控制页检查通过；保留用户当前档位与外观偏好，不重启 Codex。
- 首次填缓存、缓存淘汰/清理、素材变更或更大场景仍需加载；没有承诺所有壁纸秒切。

## 单项目与实时快切，2026-10-26

- [x] 跨渲染方式识别重复导入，现有记录按项目合并显示；保留源素材和播放版本。
- [x] 去掉库内二次应用步骤，选择立即应用，连续选择仅最后一次生效。
- [x] 候选捕获 ticket / 页内 stamp / 媒体 candidateId，取消后不重挂旧背景，已采用 GPU 不受后续取消影响。
- [x] 视频/图片接入有界缓存，修复旧 OOPIF 销毁后的约 20 秒清理等待。
- [x] 定向分组/删除引用/重复导入单测、隔离的实际指针和快速切换、原生 decode 取消、GPU 失败保留检查通过。
- [x] 真实 Codex：6 条记录合为 5 个可见项目；当前设置下视频约 0.4 秒、GPU 约 1.1–1.3 秒出现；三连选约 196ms 保留最后项，无错误弹窗；未重启客户端。
- 原生快速切换的物理画面、冷启动、睡眠唤醒与任意场景的零延迟不在上述短测结论内。

## 预览与确定，2026-10-26

- [x] 按最新要求，库内下拉只更新缩略预览，点击“确定切换”才应用。此前“选择即应用”的 UI 决策已被本项替代。
- [x] 预览选择独立保存；一次已确认切换完成后，仍保留用户后来浏览的其它预览。缓存、项目归并和后台保护保留。
