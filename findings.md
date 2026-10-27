# Migration findings

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
