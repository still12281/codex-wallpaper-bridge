# 发布检查清单

公开版本与安装资产见 [GitHub Releases](https://github.com/still12281/codex-wallpaper-bridge/releases)。资产构建步骤见[发布流程](RELEASING.zh-CN.md)。

## 源码与说明

- 按最终改动运行相关检查；沿用未受改动影响的验证结果。
- 核对版本号、README 安装地址、用户指南与实际入口行为。
- 功能说明写清触发条件、动作和失败处理；验证记录写清环境、日期与结果。
- 发布清单与隐私检查通过；保留第三方许可证、署名和来源。
- 提交指定文件，确认工作区状态与发布提交。

## 安装资产

- 从指定提交归档，前缀为 `CodexWallpaperBridge/`。
- 同时提供 EXE、EXE SHA-256、ZIP、ZIP SHA-256、`install.ps1` 和脚本 SHA-256。
- EXE 与 ZIP 来自同一提交；核对实际安装、重复安装、Windows Apps 注册、卸载及数据保留。
- 引导脚本固定版本与 ZIP 哈希，安装沿用现有数据目录。
- 草稿资产回读后逐一比对哈希，CI 通过后发布。
- 公开下载并执行 `-CheckOnly`，核对下载、解压、依赖检测与 `willStartClient=false`。
- 已发布版本的资产保持不变；包含源码或安装内容的新包使用新版本号。

## alpha.4 记录（2026-11-06）

- 提交 `8ecdf93` 已发布，Windows Node 22/24 CI 通过。
- 四项资产回读哈希一致，公开下载和 `-CheckOnly` 通过。
- 本机正常退出后一次任务栏打开恢复壁纸，主/分离窗口就绪。
- 自然更新自动恢复的验证状态见[更新恢复记录](AFTER-UPDATE-RECONNECT.zh-CN.md#验证记录)。
