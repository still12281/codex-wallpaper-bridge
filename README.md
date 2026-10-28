# Codex Wallpaper Bridge

[English](README.en.md)

为 Windows Codex 桌面客户端添加静态与动态壁纸，在客户端内切换素材、搜索 Wallpaper Engine 库、调整播放规格。

**本地壁纸 · 一体入口 · 内嵌控制面板 · 可选 GPU 场景**

[效果展示](#效果展示) · [安装](#依赖与安装) · [使用](#如何使用) · [文档](#相关文档) · [开发](#开发)

![真实桌面客户端中的空白新对话与壁纸](docs/images/01-overview.png)

这是独立社区项目，通过本机 Chromium 调试接口接入 Codex，不是 OpenAI 官方插件。

## 能做什么

- 场景可选隔离沙箱 WebGL 渲染；场景/网页也可选原生实时采集。支持导入确认、仅保存和失败回退，详见 [WebGL](docs/WEBWALLGL.md) 和 [实时模式](docs/REALTIME.md)。
- 缩略图分页、类型/分级筛选、隐藏与恢复；外观预设导入导出、已保存媒体/GPU/原版项目轮播、玻璃、字体、视差、点击与拖尾特效。
- 可选 [系统音乐联动](docs/SYSTEM-MEDIA.md)，默认关闭。
- 设置面板右下角可拖动缩放并记忆大小，标题可移动，底部可重置；保留在 Codex 内。

- 在 Codex 内导入、切换和删除壁纸记录。
- 默认只搜索各本地磁盘已发现的 Wallpaper Engine 库，包括工坊、自建与内置项目。
- 自选文件夹搜索 Wallpaper 项目，也可单独搜索普通图片/视频，默认不全盘扫描普通媒体。
- 随壁纸自动取色，适配聊天区、侧栏和常见设置页；消息和输入区分别留位。
- 静音循环、切后台暂停；宽度和 FPS 可调，转换完成后热切换，无需重启客户端。
- 每张壁纸保留一份当前播放副本，同规格不重复转换；外部原文件不因删除操作被删除。
- 可本机编译隐藏 GUI 启动入口，不需长期保持命令窗口。

## 效果展示

以下均为**真实 Codex 桌面端实拍**，使用未提交的空白新对话。收起侧栏，并在截图前隐藏账号、项目、路径、权限和歌曲信息；图库使用自制演示缩略图。图片没有拼接或替换界面，未附带真实聊天、桌面任务栏或壁纸原文件。完整 [11 张图片索引与采集说明](docs/SCREENSHOTS.zh-CN.md)。

<table>
<tr><td width="50%"><b>图库与导入状态</b><br><img src="docs/images/03-import-gallery.png" alt="类型、分级、导入状态及单项操作" width="460"></td><td width="50%"><b>外观与特效</b><br><img src="docs/images/04-appearance.png" alt="透明度、字体、视差与点击特效" width="460"></td></tr>
<tr><td><b>播放规格与场景画质</b><br><img src="docs/images/09-playback-quality.png" alt="分辨率、FPS与WebGL效果参数" width="460"></td><td><b>明亮主题</b><br><img src="docs/images/10-light-theme.png" alt="明亮主题的外观设置" width="460"></td></tr>
</table>

<details>
<summary>更多实拍：壁纸库、批量选择、作者属性、预设轮播、音乐联动与窄面板</summary>

| 壁纸库与当前运行方式 | 批量选择与保存入口 |
| --- | --- |
| ![壁纸库](docs/images/02-library.png) | ![批量选择](docs/images/07-batch-save.png) |

| 作者属性 | 外观预设与轮播 |
| --- | --- |
| ![作者属性](docs/images/05-author-properties.png) | ![预设与轮播，私人素材列表已隐藏](docs/images/06-presets-rotation.png) |

| 系统音乐联动 | 窄面板布局 |
| --- | --- |
| ![音乐联动，歌曲信息已隐藏](docs/images/08-system-media.png) | ![380像素宽面板](docs/images/11-narrow-panel.png) |

</details>

主图的第三方壁纸为 `anime-girl-saint-4K-perseutech`，权利归原作者；本仓库的代码许可不授予壁纸或客户端品牌使用权。

### 选择哪种运行方式

| 素材 | 优先方式 | 取舍 |
| --- | --- | --- |
| 图片 / 视频 | 媒体播放 | 视频按文件读取，不因几百 MB 或数 GB 的文件大小整段装入内存；仍受解码能力和磁盘空间限制 |
| Wallpaper Engine 场景 | GPU 场景 | 在沙箱中直接渲染，避免逐帧采集传输；效果兼容性取决于素材 |
| Wallpaper Engine 网页 | 原版兼容 | 默认保留原引擎效果；有采集开销和延迟 |
| 本地网页 | 网页浏览器（试验） | 使用 Chrome/Edge 加载本地资源和部分作者 API，暂停时释放浏览器，恢复时重新加载 |

GPU 不能保证兼容任意场景；打包场景、图片副本及单次资源读取仍有各自预算。详见[大文件支持范围](docs/LARGE-MEDIA-20261027.zh-CN.md)。

## 加载与更新

通过素材指纹、缩略图和场景资源缓存复用未变化的数据，减少重复读取与转换。场景先交付渲染，再异步写入磁盘缓存；视频按文件读取，减少临时内存副本。

启动入口会重新识别当前注册的 Codex 安装包。可选安装一次性更新重连规则，在后续更新事件尝试一次正常恢复，不强制终止客户端、不增加自有常驻监控。见[更新重连说明](docs/AFTER-UPDATE-RECONNECT.zh-CN.md)。

## 依赖与安装

需要 Windows 10/11 x64、官方 Microsoft Store Codex、Node.js 22+、PowerShell 7，以及单独安装的 FFmpeg（含 H.264/WebP 编码器）。可选 GUI 启动器使用本机 .NET Framework C# 编译器。Wallpaper Engine 只对其库功能必需，本地图片/视频导入不依赖它。

无需安装生产 npm 依赖。必要上游源码已最小化随附，并保留原许可证；见 [第三方来源](THIRD_PARTY_NOTICES.md)。没有随附 FFmpeg、Codex、Wallpaper Engine 程序或任何壁纸素材。

先阅读 [隐私说明](PRIVACY.md) 和 [安全说明](SECURITY.md)。在仓库根目录用 PowerShell 7 运行：

```powershell
./windows/Build-Launcher.ps1
./windows/Prepare-TaskbarEntry.ps1
```

产物默认放在 `%LOCALAPPDATA%\CodexWallpaperBridge`，源码目录不存放账号配置、素材与日志。设置覆盖项见 [配置说明](docs/CONFIGURATION.md)。移动源码目录后需重新构建启动器。

如需 GPU 场景，先在同一数据目录配置下运行 `npm run prepare:webwallgl`：下载固定版本运行时并验证完整性。系统音乐联动可选运行 `npm run prepare:media`，另需有效的 GitHub CLI；两项准备均将运行文件放在仓库外。详见 [WebGL 准备](docs/WEBWALLGL.md) 与[音乐联动](docs/SYSTEM-MEDIA.md)。网页浏览器试验另需本机 Chrome/Edge；原版兼容需已安装 Wallpaper Engine。

构建脚本生成一体入口 `CodexEntry.exe` 和 `Codex.lnk`。运行入口会核对当前注册包；匹配到过期的官方快捷方式时先备份再修复为一体入口，已有壁纸固定项只刷新官方图标引用，不自动重做任务栏固定。首次使用前，先保存草稿并完全退出普通 Codex，再运行生成的入口。需要固定时，手动将新入口固定到任务栏；相同图标/AppID 不会自动改写原任务栏入口。

已通过一体入口开启本机 CDP 会话时，可用 `npm start` 接入 loopback 9335；这条命令不会给普通客户端开启调试。调试端口不能开放到网络。

## 如何使用

打开“壁纸”后，“我的壁纸”选中只查看缩略图与运行方式，点击“确定切换”才应用。预览旁可以直接删除。

点“搜索 Wallpaper 壁纸 / 图片 / 视频”：

1. 默认类型为 Wallpaper Engine，范围为全局已发现的壁纸库；可展开“搜索位置”。任意嵌套位置、脱离登记的库不保证被自动发现，可改为自选文件夹。
2. 需要其它素材时，切换到“其它图片 / 视频”，选择目录或粘贴路径，再搜索。支持 JPG、PNG、WebP、GIF、MP4、WebM。
3. 选中结果后，预览旁显示是否需要实时渲染。单张可导入并应用或仅保存；勾选多项后，使用独立“批量保存勾选项”按钮，保持当前背景。单张按钮始终处理当前预览。批量结果会汇总成功、重复和失败项，重复单项弹窗提醒；可按全部/未导入/已导入筛选。宽度/FPS 在“播放规格”中调整。
4. 默认 1280 宽、24 FPS、静音、后台暂停。高规格仍可能卡顿，首次转换会暂时使用 CPU。
5. 删除只清理 Codex 内记录及专属副本，保留 Wallpaper Engine 和外部原文件。

自动导入场景使用完整 GPU 场景。4K 档为实际 3840×2160，可选复用 DSH v1.4.0 控制源码的 GPU 场景，或保留原版效果与音频处理的原版兼容模式；后者经确认启用，帧率跟随桌面配置。WebGL 模式在沙箱中运行场景脚本，具体效果取决于项目。网页默认使用原版兼容，也可选择[网页浏览器（试验）](docs/BROWSER-WEB-20261027.zh-CN.md)，通过本机 Chrome/Edge 加载本地网页资源。

完整库的备份、恢复、素材路径诊断与项目重定位，以及停用/卸载说明见 [本地维护](docs/MAINTENANCE.zh-CN.md)。外观预设 JSON 只包含外观，不是完整库备份。

## 相关文档

- [配置说明](docs/CONFIGURATION.md)
- [本地备份、恢复与卸载](docs/MAINTENANCE.zh-CN.md)
- [GPU 场景](docs/WEBWALLGL.md) · [原版兼容](docs/REALTIME.md) · [网页浏览器](docs/BROWSER-WEB-20261027.zh-CN.md)
- [系统音乐联动](docs/SYSTEM-MEDIA.md)
- [第三方来源与许可](THIRD_PARTY_NOTICES.md)

## 开发

```powershell
npm test
npm run check:privacy
npm run test:integration # 可选，需要 Chrome/Chromium 和 FFmpeg
```

测试使用合成素材与隔离页面，不读取真实聊天/账号配置，不自动连接正在运行的 Codex。

## 许可与致谢

原创代码许可见 [LICENSE](LICENSE)，上游版权与许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。壁纸素材、商业客户端和品牌资产不属于本项目的代码许可范围。
