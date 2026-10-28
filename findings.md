# Migration findings

## 2026-10-28 性能与源码alpha准备

- 场景首帧原先等待Cache API完整写入；File输入可用作Response源，避免再构造整包缓存字节副本。改为先投递沙箱、有界后台写入，同键查询等待写入后复用。实际隐藏212MB对照1478→870ms，输出/效果相同；不能当作完整可见切换或常驻内存降幅。
- 指纹与库预览原缺少版本复用，分别增加64项元数据哈希和64项/8MiB预览缓存；源变化/取消/目录围栏保留。76个Node测试、相关隔离集成通过。
- 任务栏旧成功状态只确认Page.bringToFront，未检查原生窗口。当前CDP窗口查询不受支持，新增按已验证主页面几何/同会话句柄匹配的原生恢复及前台读回。仅只读检查和RememberOnly记录当前窗口，不操作用户窗口作模拟验收。
- 根README改为中文；发布图采用三张清晰截图和可选短动图的准备清单，不直接发布真实聊天。源码alpha可准备；gh本机凭据失效、无remote，实际发布信息仍需确认。

## 2026-10-26 当前计划依据（只读结论，实施前复核）

- 新完整计划为 `docs/EXECUTION-PLAN-20261026.zh-CN.md`，T01—T14 全覆盖；本轮仅编制计划，不启动功能实施或迁移新聊天。
- 截图与源码对应：图库列数使用视口媒体查询而非面板宽度；预览吸顶与批量操作区存在布局/重复入口问题。引用浮层、额度卡片等同类表面仍需按实际 DOM 检查，不宜全局强制透明。
- 视频转换使用软件编码、限制线程并逐项完成，当前完成转换后才检查 32/128 MiB 上限；可预防的长等待和失败需先做预检、快速复用与恢复。不能仅提高大小限制而忽略宿主加载/缓存成本。
- 已接入 DSH renderer.js 和 WebWallGL，DSH 上游还有网页与输入接口；这不等于 Codex 已有可用的网页资源通道，也不代表全部原版效果兼容。优先上游、再检索成熟实现、最后最小自研。
- 执行前保持最新库记录与用户选择；历史速度、质量、PID 和库数量只作对照，不作为恢复目标。启动/系统睡眠、长期 GPU 与跨版本/机器仍有待验收项。

- Codex bridge has image/video, library discovery, native capture, a single-instance launcher and scoped native surface mappings. Preserve these.
- DSH depends on Cordis/webServer/client runtime/React/slots; wholesale installation into Codex is unavailable.
- WebWallGL 3.0.0 has a self-contained global browser bundle already prepared locally. Its source is MIT; wallpaper assets are separate and never redistributed.
- A sandboxed blob iframe is allowed by native CSP; the old prototype transfers scene bytes with CDP and creates an isolated execution world. HTTP embedding failed previously.
- Candidate direct reuse: upstream picker-model, fx-layer, parallax algorithms. Rotation and presets require a host-neutral adapter.

- Exact upstream picker-model and FX sources are retained unchanged and hash-checked. Code adapters provide shared-scope variables; presets use a new explicit Codex schema instead of copying asset-bearing DSH snapshots.
- Independent review caught media rollback/removal, resize, resource concurrency, listener cleanup, rotation locking and thumbnail memory limits. Implemented candidate media layers, bounded logical iframe size, queued asset reads, explicit disposal, serialized scheduler and 8 MiB/96-item preview cache.
- Transport `id` is reserved for request correlation; preset actions use `presetId`. UI roundtrip caught and fixed the field collision that direct action unit tests did not expose.
- Empty synthetic scenes can enter the engine's idle state; resume acceptance checks the paused state, while native dynamic scenes independently provide changing-pixel evidence. A transient early frame-navigation failure was diagnosed with frame/target inventory; repeated full sandbox runs subsequently passed.

- Native library audit accepted 24-card pages and real previews, save-only WebGL import, application and return to the prior video with no leaked renderer. Generated native Web capture accepted changing frames and stopped its source.
- Embedded panel resizing uses explicit pointer capture; tests must include the pressed mouse button during CDP movement. Initialize grip placement synchronously on open, and suppress backdrop clicks from resize release. User canceled the separate-window proposal.
- Optional system media is Windows-only, protocol 1, online lyrics disabled, metadata/audio opt-in. A live native silent sample delivered spectrum; no nonzero visual music acceptance is claimed. Source state plus a fresh received frame gates external audio.

- Batch checkboxes were only connected to visibility. They now drive save-only imports, separately from the highlighted detail item; summary reports per-item errors and duplicates.
- Media duplicate identity uses content hashes when available; an old external source path cannot establish the bytes originally imported, so historical mutable paths are not retroactively treated as content identity. Renderer versions remain distinct.
- Preview review required format-constrained FFmpeg input/protocols, bounded caches, completed/inflight hits and coalescing saved previews to the latest selection.
- Native current-player control exposed an actual Windows source switch after pause. API accepted does not imply observed state change. Restored the exact original music session; added source identity checks, explicit play/pause and mandatory readback. Full pinned-player control remains unsupported by the external helper.
## 2026-10-25 display regression intake
User screenshots show a large white diagonal area in the scene and an unreadable dark error dialog with dark text. Screenshot 2 reports a player-command confirmation failure, not proof of renderer failure. Suspected theme inheritance must be checked with computed styles. Existing current changes belong to earlier turns and must be retained. No screen control or client restart.

Confirmed: adaptive post-processing reached off and exposed an audio-effect solid layer. Dialog computed dark background/dark text confirmed. autoQuality is now disabled; matched theme colors pass contrast checks. The old UI omitted audioFps in send/readback despite backend validation; corrected and covered by a headless UI test. Native JSON needs verbatim RAW payload; bounded source capture passed, but native Codex performance remains pending.

Bounded native capture acceptance: raw command-line escaping was the first failure. Verbatim RAW JSON succeeded; 68 frames (about 12.27 captured FPS) and eight unique early frame hashes. Real frame shows original fonts and circular bars; it was not applied to Codex. Dedicated helper exited and desktop monitor selections were preserved. No raw workshop assets or screenshots were added to Git.
## Reopened-client regression, 2026-10-25

- The actual fixed taskbar item resolves to the Store package, not the generated wallpaper shortcut. The reopened official process has no CDP argument/listener. Window relaunch-property readback was insufficient evidence of replacing the fixed entry.
- The generated entry/shortcut/owned windows now share an independent desktop identity while retaining the original official icon. Bootstrapping reports failure, checks fresh browser identity and ready targets, and does not restart an already running ordinary client. Inspection has its own status file.
- Native restart/repinning is user-owned and still pending. No current client was closed or screen input sent.
- Isolated original-scene trials (including real AMD ANGLE D3D11) did not reproduce the white polygon. Critical effect failure now preserves the old candidate, but this must not be reported as proof of eliminating the original trigger.

## 2026-10-25：只读审计与原生最高档计划

- 当前启动记录、存活进程和 loopback CDP 浏览器身份一致；主窗口视频实际播放，分离窗口失焦暂停。旧的“当前普通客户端没有 CDP”是历史状态，不能作为当前结论。任务栏分组/显示仍缺少真实验收。
- 当前选择仍是工坊 3600630828 的视频层；音频偏好开启不意味着该视频拥有独立音频条。部署 src 的 25 个文件与源码一致，发布检查通过；这些不等于完整原生场景最高档已完成。
- 既有原生路线使用 Wallpaper Engine 自身渲染，再通过 WGC/JPEG/Node/CDP/canvas 接入。效果和原生音频复用具有优势，但 JPEG 品质固定 78、额外延迟和总资源成本需要测量；原生鼠标交互当前未转发。
- 新发现：runtime-status.targets 在遍历窗口时被当前项覆盖，导致文件可能只显示暂停的分离窗口；SECURITY、README 和发布清单也有过时描述。完整备份/恢复、素材重定位与停用卸载应纳入后续阶段。
- 本轮用户要求先列计划、最高档优先、减少不重要测试并分阶段提交。详细顺序和验收门槛写入 task_plan.md 最新中文计划；没有开始新的运行时实现。

## 2026-10-26 原生最高档执行发现

- 原生路线已在真实 Codex 运行，恢复原版日期/时钟、字体、粒子与音频环；桌面自定义属性仅应用于独立命名源窗口，桌面全局/选中项保持。
- JPEG 编码根因已用同帧对照确认：BGRA 的非连续三通道切片触发通用拷贝，改为直接 BGRA 后编码字节一致且明显加快。有界两帧流水线解决解码往返超过源帧周期时的吞吐损失。
- 采集回调到 draw 的时间是代理指标，不能冒充从原生 Present 到物理屏幕的完整延迟；目前原生鼠标输入仍存在差距。
- 固定音频样本、慢窗口与坏候选证据均在外部 ReleaseWork；无聊天或桌面截图进入 Git。维护工具的 Windows 短路径问题已修复并有定向回归。

- 诊断中一次整幅 PNG 导出发生 CDP 连接断开，但客户端和宿主存活；具体原因未确认，改为 960px JPEG 预览后成功。未将其误记为渲染器崩溃。
- 最终只读复核发现并修复 FPS 编辑丢失比例/品质、超时未取消远端解码导致继续积压两项边界。1900ms 超时隔离与显式重试的真实窗口检查通过；原生交互和物理呈现延迟仍未接受。
# 2026-10-26 执行包 A

- 当前源码基线 052338f，初始无未提交改动。实际客户端主/分离页均有 v13 面板，当前是 1280×720 媒体，不能恢复历史 GPU/原生选择。
- 图库仍用 viewport `@media(max-width:520px)`；导入预览 sticky/top:-24px 会遮挡小面板；两单项按钮按勾选数量改成同一批量流程，另有第三个批量入口。
- 当前只读 DOM 中引用栏已透明、utility rail 为配色 .48；tooltip/popover/额度卡片未打开，不能声称已实际验收。先按当前语义选择器与材质变量补齐，隔离样例覆盖，真实未出现项如实留存。
- 设计：Fluent 的语义色/中性色/交互状态作主规范，借鉴 shadcn 的 primary/secondary/destructive 分类及 DSH 的轻量 token/图库结构；保留原生控件、dialog、Shadow DOM，不引入 React/Tailwind。仅参考公开规范，无复制第三方组件源码。
- 诊断发现 runtime-status.json 为空且未发现旧 video-cdp-host 进程；客户端页内背景仍 ready。当前阶段只更新 UI，保留客户端/媒体层；不将旧运行日志当当前宿主运行证据。
- 读取不存在的 native-surfaces.mjs 失败后，已用 rg 确认实际实现位于 wallpaper-style / wallpaper-widgets / upstream-adapters；Windows rg 不展开 windows/*.ps1，后续使用 --glob。

## B 调查与首批实现

- A 本地提交 `329d29d`。B 开始确认只读请求 2.5 秒无回应且无宿主进程；恢复原有宿主后收到真实错误回读，主/分离背景 ready。恢复前后配置全部顶层字段一致；没有证据证明旧宿主为何退出。
- 实际媒体载入仍限制 32/128 MiB，与场景缓存的 256 MiB 单项/512 MiB 总量不同；不单独提高导出上限。现有 source/hash duplicate 和同规格免重生成保留。
- 原 commitConverted 在 rename 后 save 失败时只清旧 pending，且可能覆盖旧 destination。已改独立最终版本，并把保存作为提交点；customDisplay.file 纳入引用保护及删除后清理。
- 上传失败原来会在转换前丢掉上传会话，造成孤儿；现保留到成功或统一失败清理，容量风险待用户选择时保留会话，返回调整则显式清理。
- 已核对 FFmpeg/ffprobe 官方文档的机器可读探测、streamcopy 和 progress；只做必要过滤。ffprobe 按源版本有界缓存 32 项；容量是估算，输出仍有硬限制，不使用截短输出蒙混通过。
- 定向事务/真实 FFmpeg 样本共 5 项通过。8秒 1280×720 H.264/24/no-audio：原重新编码1551ms，新冷探测+复制72ms，保留原2,607,211字节；此样本不能推断 Scene/Web 或长视频整体速度。
- 新实现尚未部署；队列中的取消、进度推送及结果复用仍待实施。当前 actionQueue 会阻塞普通取消；acting 全段为 true 会暂停原生采集/频谱泵，需只允许纯文件准备期并行现有背景，提交仍串行。
- 首次替换转换器的 apply_patch 因同一文件同时 Delete/Add 被拒；改为 Update 后语法检查通过，未反复重试原补丁。
- B3 已增加 owner/operationId 有界任务表，取消是唯一队列旁路；排队注册/取消 tombstone 防止重试复活，提交阶段拒绝取消。进度由实际转换回调推送，哈希/复制/探测支持取消；纯文件准备期放行现有原生帧/频谱，设置提交保持串行。
- 单元与真实隔离宿主检查：正在转换+排队同时取消、文件清理、提交期拒绝取消、连续40次放弃场景确认不耗尽任务槽、失败保存保留旧字节通过。UI 中取消不计入导入成功，失败/未完成勾选保留，同一按钮可仅重试失败项。
- 转换缓存按源path/size/mtime/ctime+MIME+规格+算法版本失效，最多16项/256MiB；仅在配置提交成功后缓存，优先同卷硬链接，必要时复制；删除缓存不删除已保存副本。上传批次由384KiB提高至2MiB，服务器仍校验声明长度和最大请求量。

## C 只读准备（未实施）

- 固定 DSH v1.4.0 控制层 / WebWallGL3.0.0，GPU、资源broker与候选保护已有；不把整套DSH插件或其HTTP服务算成宿主已复用。
- 首选 C4：DSH/WebWallGL 已提供 setProperties/getProperties；需作者属性UI、类型/范围校验、按逻辑壁纸持久化和首次注入。DSH lib/we-props.js 会丢 editable:false 属性，与WE“隐藏UI但仍下发”不同，不能原样照搬。
- C5：补pointerup/cancel/leave/blur清按钮、修饰键与至少16ms按键边缘；被动转发且排除聊天contenteditable/控件，不能截获输入。pushWheel上游只对Web有效，不能宣称Scene滚轮生效。
- C2：WebWallGL source.webEntry依赖可导航URL与相对资源，现字节broker没有通用导航服务。不能删guard或绕CSP；候选为仅沙箱子目标、令牌虚拟URL+Fetch.fulfillRequest的有界可行性试验，仍未验证。
- C3：字体/日期/粒子/模型骨骼/SceneScript/效果有上游实现，组件SKIP_COMPONENTS=true，动态切未预载字体仍可能回退；未做逐场景保真验收。
- 只读核验两上游MIT：WebWallGL main仍197abe5、最后推送2026-10-14；DSH main于2026-10-26到7ba44b2，未整体升级。AnySearch一条Web查询失败，另一条返回WE官方属性文档；GitHub只读核验成功。详情来源：本地上游lib/we-props.js、src/live-layer-pointer.js、renderer/src/{web,scene-mount,api/mount}.ts；WebWallGL issue16仍开放。

### C4/C5 首批源码（尚未部署）

- 原样纳入 pinned DSH lib/we-props.js 和 src/we-cond.js，并登记原始/规范化哈希。宿主包装在内存克隆中适配 editable:false，隐藏UI但保留脚本默认；条件只控制显示，使用上游tokenize/parse而不用全局无限编译缓存或eval。
- 属性按libraryGroups共享到同逻辑壁纸的各模式记录，原版/媒体仅保存待GPU启用。首次装配注入与运行中setProperties热更新、类型/范围校验、恢复默认、错误回退已有实现；可编辑首批bool/color/slider/combo，其它类型说明保留。
- 首次隔离实际WebGL测试发现仅给MountOptions.properties仍回到gain=.35默认；源码scene-mount会重建liveUserProps。已在initializeRenderer内先给序列化project metadata注入覆盖（磁盘原件不动），再装配；第二次测试初始gain=.7和热更新=.9回读通过。
- 指针转发新增up/cancel/leave/blur/隐藏时释放、ctrl/shift/alt/meta位与至少一帧按键保持；监听被动，排除contenteditable、chat scroll、控件、代码与选中文本。Web wheel协议接线仅在Web类型下可用，Scene没有滚轮语义。
- 隔离WebGL首帧/像素、属性回读、失败候选保留、频谱attach/detach、暂停恢复、监听器清理与事件边缘通过。空场景没有可见图层，不能证明真实工坊属性/鼠标视觉效果；local-assets Invalid URL警告和simulated-stream诊断仍保留，不能将这些日志当原版兼容/真实音频验收。
- 独立复核问题已修：切换作者属性key即清空旧字段并捕获目标ID；busy结束同步新出现控件；默认wire保留原始JSON而非把未知类型对象转字符串；保存不顺带删除原有未支持覆盖；延迟up释放最新坐标。属性单元和作者面板竞态/类型检查通过。C源码未部署，当前实际客户端仍B面板v15。
- C2有界试验：只读取得当前客户端CSP，复制到独立headless页面；对虚拟项目URL的fetch被connect-src阻断，Fetch拦截请求数0。结果在仓库外package-b-work/web-csp-result.json。没有尝试伪装成可信OpenAI域、放宽CSP或开放Web入口。
- D只读：上游FrameGate可接正FPS，本项目当前限制12/24/30/60；若续做，GPU高刷应独立于媒体/原生限制，60Hz环境不能验收120/144实际呈现。E的冷启、睡眠、正常退出清理及任务栏/闪屏需用户正常操作；未实施这些新功能。

## 2026-10-27 当前续接结果

C属性/输入与内嵌字体、D真实口径/高刷/4K R=1/有界缓存、E逻辑轮播/失败恢复/备份已部署v18。运行34个src模块一致，9条库与配置保留，官方客户端未重启。30分钟隔离资源结果结束，内存早末private commit497→533MiB且末段26MiB跃升未完全归因；不能宣称无泄漏。具体T01—T14未完成项与证据见docs/PACKAGE-E-20261027.zh-CN.md；Web不绕CSP，正常冷启/睡眠/任务栏等留用户正常操作。
