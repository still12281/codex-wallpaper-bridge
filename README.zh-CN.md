# Codex Wallpaper Bridge

[English](README.md)

为 Windows Codex 桌面客户端添加静态与动态壁纸，在客户端内切换素材、搜索 Wallpaper Engine 库、调整播放规格。

**当前为源码形式的实验性开源候选。** 这是社区项目，依赖本机 Chromium 调试接口和客户端 UI 结构，不是 OpenAI 官方插件；客户端更新可能导致不兼容。启动动画暂未实现，完整冷启动与任务栏入口仍需进一步验证。

## 能做什么

- 在 Codex 内导入、切换和删除壁纸记录。
- 默认只搜索各本地磁盘已发现的 Wallpaper Engine 库，包括工坊、自建与内置项目。
- 自选文件夹搜索 Wallpaper 项目，也可单独搜索普通图片/视频，默认不全盘扫描普通媒体。
- 随壁纸自动取色，适配聊天区、侧栏和常见设置页；消息和输入区分别留位。
- 静音循环、切后台暂停；宽度和 FPS 可调，转换完成后热切换，无需重启客户端。
- 每张壁纸保留一份当前播放副本，同规格不重复转换；外部原文件不因删除操作被删除。
- 可本机编译隐藏 GUI 启动入口，不需长期保持命令窗口。

## 依赖与安装

需要 Windows 10/11 x64、官方 Microsoft Store Codex、Node.js 22+、PowerShell 7，以及单独安装的 FFmpeg（含 H.264/WebP 编码器）。可选 GUI 启动器使用本机 .NET Framework C# 编译器。Wallpaper Engine 只对其库功能必需，本地图片/视频导入不依赖它。

无需安装生产 npm 依赖。必要上游源码已最小化随附，并保留三份原许可证；见 [第三方来源](THIRD_PARTY_NOTICES.md)。没有随附 FFmpeg、Codex、Wallpaper Engine 程序或任何壁纸素材。

先阅读 [隐私说明](PRIVACY.md)、[安全说明](SECURITY.md)、[验证边界](docs/VALIDATION.md)。在仓库根目录用 PowerShell 7 运行：

```powershell
./windows/Build-Launcher.ps1
./windows/Prepare-TaskbarEntry.ps1
```

产物默认放在 `%LOCALAPPDATA%\CodexWallpaperBridge`，源码目录不存放账号配置、素材与日志。设置覆盖项见 [配置说明](docs/CONFIGURATION.md)。移动源码目录后需重新构建启动器。

脚本只生成新的 `CodexEntry.exe` 和 `Codex.lnk`，不替换原有快捷方式或任务栏固定。请先自行保存草稿并完全退出普通 Codex，再使用生成的入口；启动接入仍属实验能力。需要固定时，由用户手动将新入口固定到任务栏。相同图标/AppID 不会自动改写原任务栏入口。不要通过反复重启来排错。

已有经过验证的本机 CDP 会话时，可用 `npm start` 接入 loopback 9335；这条命令不会给普通客户端开启调试。调试端口不能开放到网络。

## 如何使用

点右上角“壁纸”→“搜索 Wallpaper 壁纸 / 图片 / 视频”：

1. 默认类型为 Wallpaper Engine，范围为全局已发现的壁纸库；可展开“搜索位置”。任意嵌套位置、脱离登记的库不保证被自动发现，可改为自选文件夹。
2. 需要其它素材时，切换到“其它图片 / 视频”，选择目录或粘贴路径，再搜索。支持 JPG、PNG、WebP、GIF、MP4、WebM。
3. 选择结果并导入；宽度/FPS 选好后点击“应用播放规格”。转换需要时间，完成后自动热切换。
4. 默认 1280 宽、24 FPS、静音、后台暂停。高规格仍可能卡顿，首次转换会暂时使用 CPU。
5. 删除只清理 Codex 内记录及专属副本，保留 Wallpaper Engine 和外部原文件。

场景包仅尝试提取单一背景视频，不支持完整网页/纯实时 3D 场景、独立脚本、时钟和复杂特效。这不是 Wallpaper Engine 原渲染器，也不是实时跟随其桌面渲染。

## 开发与验证

```powershell
npm test
npm run check:privacy
npm run test:integration # 可选，需要 Chrome/Chromium 和 FFmpeg
```

测试使用合成素材与隔离页面，不读取真实聊天/账号配置，不自动连接正在运行的 Codex。整理候选的测试通过，不等同于完整原生冷启动验收。

## 开源发布说明

项目暂定名 **Codex Wallpaper Bridge**，原创部分拟用 **MIT**，正式发布前由维护者确认。没有填写真实姓名、邮箱、GitHub 账号或仓库链接。上游版权与许可证完整保留；壁纸素材和商业客户端不属于本项目的开源许可。

正式发布还需确定仓库归属/名称、公开署名、许可证、维护与反馈方式；详见 [发布前信息清单](docs/RELEASE_CHECKLIST.zh-CN.md)。本候选没有 Git 历史、远程地址、用户数据或发布二进制。
