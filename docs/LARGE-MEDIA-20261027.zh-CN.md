# 大视频文件：文件支持的 Blob 与流式准备

用户指出壁纸常有几百MB甚至几GB；本阶段改变视频加载方式，而非单纯提高原32/128MiB数字。截图对应的容量策略和DSH网页核查见 [界面记录](UI-WEB-20261027.zh-CN.md)。

## 实施

- 视频播放器通过真实managed媒体路径围栏 → detached file input → File-backed Blob URL，让Chromium按需读取。不读整文件ArrayBuffer、不走Base64/CDP数据传输、不进入Scene CacheStorage。仍先验证候选首帧再替换旧背景；失败、取消和切换均撤销候选URL、清空输入并释放CDP对象。
- 兼容且符合所选尺寸/帧率的MP4，不再因总大小超过32/128MiB而强制转码；仍沿用无音轨copy、有音轨remux去音轨、必要时才缩放/转码。输出为本项目managed副本，保留原素材、customDisplay、静态档、删除与备份模型。没有偷偷改为不包含素材的外部引用。
- 本机“导入图片/视频”改为原生文件选择器，宿主只向UI返回owner-scoped随机token；后续请求不接受任意文件路径。选择器属于可取消导入任务，AbortSignal可结束其PowerShell，断连/晚返回不再授予过期token。文件夹媒体扫描不再忽略大于250MB的文件。原250MB浏览器分块上传留作旧路径兼容，不再是主按钮的大文件入口。
- 准备副本采用1MiB流式复制，可取消并清理；视频容量由可用磁盘预算保护，保留64MiB余量，复制及转码期间检查剩余空间。转码的45秒无进展/15分钟总时限仍保留，不能宣称所有几GB长片都无需转换或一定能在该时限完成。
- 超256MiB转换结果直接跳过转换缓存，避免复制后马上淘汰；大视频播放本身不缓存全量字节。备份/恢复SHA256改为流式，复核复制前后源版本、目标大小和hash，防止成功写出不可恢复的大小记录。
- 图片仍保留原副本容量保护；媒体总文件大小与解码分辨率/fps是两件事，流式不消除高分辨率解码的CPU/GPU成本。

## 证据与限度

1. 生成合法MP4容器，大小2,416,037,566字节：有效内容为4秒320×180视频，末尾为稀疏free box。它不是2.4GB真实编码视频，只用于验证大文件大小、64位寻址和避免整读。
2. 独立Chromium＋实际宿主：约553ms候选就绪，跳到3秒成功。强制File.arrayBuffer和FileReader.readAsArrayBuffer抛错时仍成功；主页面backing约23KB、宿主ArrayBuffer约119KB。预检为copy/fileBacked；扫描保留大文件、owner token拒绝跨owner和流式复制取消清理通过。未把这些计数当整个Chrome或实际Codex的内存增量。
3. 真实Codex隐藏候选约86ms首帧就绪，当前背景对象/图层和配置字节保持。该主页面当时hidden，视频paused，不能说真实可见播放、完整导入或实际大编码素材性能已验收。
4. 原媒体准备/备份/取消/事务11项、选择器生命周期2项、已有隔离端到端和面板检查通过。原生文件选择器脚本语法检查通过；未为测试弹出或操作用户桌面对话框，真实用户点选往返仍待正常使用验收。
5. 部署11个运行/维护文件，仅重载自有宿主为20996；38个src模块与源码一致，原13条库和配置字节、官方Codex browser identity保留。分离页已新装配ready；主页面hidden，按既有逻辑等待恢复可见再装配，当前旧背景仍ready。没有把首次检查等待两页ready未满足说成两页均通过，也未主动前置窗口。

外部证据：`../large-media-work/{result.json,native-result.json,panel-result.json,deploy-result.json,backup/}`及同目录脚本。生成素材、用户配置和日志不入Git；没有新增常驻监控或生产端强制GC。

## 外部引用直读（兼容图片与 MP4 原片）

- **免转码直读策略（`src/media-preflight.mjs`、`src/media-converter.mjs`、`src/wallpaper-actions.mjs`）**：
  - 对通过本机选择器、文件夹扫描或 Wallpaper Engine 图片/视频项目导入的外部本地文件，当规格满足当前播放档位时，不再复制到 `media/`，而是将规范化后的外部 `sourcePath` 直接登记为播放路径（`route: "direct"`，零额外空间占用）。
  - 兼容图片条件：`image/png`、`image/jpeg`、`image/webp`，无旋转元数据，分辨率不超过当前档位上限且文件大小不超过对应图片容量保护（32/128 MiB）。
  - 兼容视频条件：`video/mp4` 容器、`h264` 编码、`yuv420p` 像素格式、方形像素、无旋转、分辨率与帧率不超过当前档位上限且视频流码率在直读阈值内；携带音轨的兼容 MP4 同样直接外部引用，由播放器 `<video muted>` 强制静音，不再额外 `remux` 生成副本。
  - 分辨率/帧率超标、非 MP4/H.264/yuv420p（如 HEVC、MKV、WebM、GIF、10-bit）、带旋转或超高码率的原片，继续按默认温和档位（`1280 / 24 FPS`）经 `ffmpeg` 生成 `media/` 受管副本；旧浏览器分块上传入口（`import-end`）也继续使用受管路径。
  - 切换快捷显示档位或手动调整播放规格时，仅在需要缩放/转码时生成受管变体；切回兼容规格或恢复 `custom` 时重新直读原片，并自动清理不再被引用的旧受管变体。
- **安全围栏（`src/media-file-source.mjs`、`src/video-cdp-host.mjs`、`src/library-preview.mjs`）**：
  - 媒体读取和缩略图预览统一通过 `resolveAuthorizedMedia` 校验，仅允许两类路径：`media/` 下的受管媒体文件，以及已在 `settings.library` 登记的本机外部媒体路径。
  - 统一拒绝 UNC/网络共享路径、`..` 相对跳转、非受支持媒体扩展名，以及文件自身或任意上级目录上的符号链接/目录联接；加载视频和图片前后复核 `realpath`、`size`、`mtimeMs` 与 `ctimeMs`，防止加载期间路径替换或文件变更。
- **原文件失效、删除与备份恢复（`src/media-store.mjs`、`src/video-cdp-host.mjs`、`tools/library-maintenance.mjs`）**：
  - 外部原文件被移动、改名或删除（例如 Steam 取消订阅）时，手动切换返回明确错误并回滚保留当前背景，轮播跳过失效项继续切换下一张，缩略图预览降级返回不可用状态；若启动时当前选中项已失效，宿主仍保持设置面板可打开并提示错误。
  - `removeManagedFile` 仅删除 `media/` 与 `staging/` 下的相对受管普通文件，拒绝绝对路径与符号链接；删除外部引用条目时只清理衍生受管变体和静态截图，不触碰外部原文件。
  - `tools/library-maintenance.mjs` 的备份与恢复同步支持外部媒体引用（清单标记 `externalMedia: "references-only"`），保留路径引用且不复制大体积外部原片，拒绝 UNC 路径，并继续对受管文件执行流式 SHA-256 校验；`diagnose` 可检出丢失的外部媒体路径。

## 几GB场景如何处理

视频现在有按需文件读取路径；GPU Scene包仍由WebWallGL整体解析，现有单资源512MiB/累计768MiB与纹理预算不因此解除。几GB场景优先选择已有“原版兼容模式”，让Wallpaper Engine读取和渲染，Codex接收采集帧；其实际可加载程度仍取决于原引擎及机器资源。没有宣称GPU几GB包已支持。

独立网页渲染窗口是可行候选，尚未实施；DSH完整资源服务、作者sandbox与自有Electron/WGC组合的证据见界面记录。不能把当前iframe失败推出“网页做不到”。

仍待相应样本：真实几GB编码素材的导入/可见播放/长时解码及音频连续性，真实磁盘触顶与长转换，巨大GPU资源按需解析；浏览器主进程内存owner、可见高刷/完整切换、用户正常冷启/睡眠/任务栏及跨机器等原边界继续保留。
