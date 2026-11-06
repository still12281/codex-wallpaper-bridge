# 登录后自动打开带壁纸的 Codex

从 **0.1.0-alpha.2** 起提供显式配置；默认安装和升级保持原登录启动设置。

## 为什么开机打开了 Codex，却没有壁纸

官方 Codex 的 Windows 登录启动任务直接打开普通客户端，没有经过壁纸一体入口，也没有壁纸所需的本地调试参数。若普通客户端已经运行，壁纸入口会保留它并停止接入。更新事件恢复任务只处理更新，不处理登录。

配置登录启动后，Windows 将通过 Startup 文件夹中的 `Codex Wallpaper.lnk` 调用数据目录里的稳定 `CodexEntry.exe`。它沿用一体入口的当前包识别和已保存壁纸，不增加监控、定时器、服务，也不修改官方程序文件。

## 安装时启用

在解压后的 **alpha.2 或更新版本**目录中运行：

```powershell
./Install.cmd -LoginStartup enable
```

自定义目录加 `-DataDirectory 'D:\CodexWallpaperBridge'`；已有安装继续使用原目录。`-LoginStartup keep` 是默认值，不更改登录设置；`disable` 只撤销本功能管理的配置。

## 已安装后启用、检查或撤销

在 PowerShell 7 中运行：

```powershell
$root = Join-Path $env:LOCALAPPDATA 'CodexWallpaperBridge'
$bootstrap = (Get-Content -LiteralPath (Join-Path $root 'launch-script.txt') -Raw).Trim()
$login = Join-Path (Split-Path -Parent $bootstrap) 'Set-LoginStartup.ps1'
& $login -Root $root -Mode enable

# 只读检查，不创建快捷方式、不启动客户端
& $login -Root $root -Mode inspect

# 撤销托管登录启动，恢复原来的官方登录启动状态
# & $login -Root $root -Mode disable
```

自定义安装时修改 `$root`。旧版本没有此脚本，先将 alpha.2 或更新版本安装到同一数据目录。

配置不会给当前普通客户端补上调试接口。若现在没有壁纸，保存工作并从应用菜单正常退出 Codex，再打开壁纸入口。下次登录才会实际经过新配置；检查通过不代表已完成开机实测。

## 备份与保护

- 从已验证 Store 包的 manifest 识别实际启动任务，只处理该任务在当前用户 HKCU 下的 `State` 值。原值及其是否存在记录在数据目录的 `login-startup.json`；不会覆盖同键下的其它值。
- 显式启用时将官方启动任务设为用户停用状态，避免普通入口抢先启动；组策略控制或未知状态直接停止。状态含义见 [Microsoft StartupTaskState](https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.startuptaskstate)。Startup 文件夹方法见 [Windows 启动应用配置](https://support.microsoft.com/en-gb/windows/experience/startup-boot/configure-startup-applications-in-windows)。
- 只管理记录中路径和 SHA-256 均匹配的快捷方式。同名无关文件、后来编辑的快捷方式、不同安装目录的记录均停止处理并保留。重复启用不覆盖最初的恢复记录；升级后的快捷方式更新保留该恢复链。
- 停用时只移除未被编辑的托管快捷方式；官方任务仍是本功能写入的值时才恢复原值，保留之后的用户或策略更改。写入失败会尝试回滚本次修改；进程被强杀留下 `preparing` 记录时停止处理，请先核对记录与实际状态。
- 若 Windows“启动应用”已禁用 **Codex Wallpaper**，先在那里手动启用。若自己另建过 Codex 登录快捷方式，先检查并自行移除重复项。
- 卸载或迁移数据目录前先执行 `-Mode disable`。不要仅删除程序目录而留下失效的登录快捷方式。备份记录是私人配置，不要上传整个数据目录。

## 验证范围

隔离测试覆盖启用/停用、原值为 0/1/2 或不存在、重复执行、其它注册表值保留、同名冲突、用户修改、策略拒绝、写入拒绝、回滚失败后的独立清理、启用/停用提交失败，以及升级快捷方式后的原始恢复链。安装器显式传入 `-LoginStartup enable -CheckOnly` 后原生状态及启动文件夹内容保持一致。实际已注册 Codex 包与 manifest 任务发现通过只读检查；当前客户端未重启。

验证状态：真实 Windows 登录与全新机器检查未执行。此设置管理当前用户 Startup 文件夹中的壁纸入口；系统恢复应用、用户自行创建的入口和包更新激活各走自己的启动路径，更新激活由[自动更新恢复任务](AFTER-UPDATE-RECONNECT.zh-CN.md)处理。
