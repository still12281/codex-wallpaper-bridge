# Windows 安装与配置

## 推荐：双击安装

1. 安装官方 Microsoft Store 版 Codex，正常打开一次并登录。
2. 从仓库 [Releases](https://github.com/still12281/codex-wallpaper-bridge/releases) 下载固定版本的 `CodexWallpaperBridge-*.zip` 和对应 `.sha256`，解压到本地文件夹。不要在压缩包预览中直接运行。
3. 双击根目录的 **`Install.cmd`**。选择新建专用入口或替换原快捷方式，并选择是否启用更新后一次重连。保持联网，按 Windows 提示允许依赖安装。
4. 出现绿色 **Installed** 后，保存工作并正常退出原来的 Codex。若客户端仍在后台运行，从其退出菜单结束会话。
5. 专用模式打开 **Codex Wallpaper**；替换模式使用原名称的 Codex 入口。以后从所选入口启动带壁纸的 Codex，需要时将它固定到任务栏。

不需要安装 Git、手动执行 npm install 或配置环境变量。安装器不会替你安装/登录商业客户端，也不会关闭正在使用的 Codex。

安装器自动完成：

| 步骤 | 具体内容 |
| --- | --- |
| 检查客户端 | 识别当前用户已注册的官方 Codex 安装包 |
| 准备基础依赖 | 检测 PowerShell 7、Node.js 22+、FFmpeg 和 uv；缺失或版本不符时通过 WinGet 安装 |
| 准备渲染组件 | 下载并校验固定版本 WebWallGL，准备 Python 3.12 与锁定版本的原版采集依赖 |
| 安装程序 | 按发布清单校验并复制到数据目录的独立版本子目录 |
| 生成入口 | 使用已安装 Codex 的官方图标，按选择新建专用入口或备份后替换已识别的原快捷方式 |
| 保留用户数据 | 保留已有壁纸库、设置和旧版本；安装不启动/关闭 Codex，只在明确选择启用时安装更新事件任务，无自有常驻监控 |

首次安装需要下载依赖，耗时取决于网络。依赖安装使用 [WinGet 标准安装命令](https://learn.microsoft.com/en-us/windows/package-manager/winget/install)，会接受指定依赖及软件源的安装协议；系统安装程序可能请求管理员授权。

## 快捷方式怎么选

| 模式 | 行为 |
| --- | --- |
| `separate` / 安装时选 1 | 创建桌面与开始菜单的 Codex Wallpaper，原入口保持原样；以后启动也不自动替换原快捷方式 |
| `replace` / 安装时选 2 | 备份并替换当前用户桌面/开始菜单中已识别的 Codex/ChatGPT `.lnk`，保留名称；没有可替换文件时创建桌面 Codex |
| `none` | 只生成数据目录里的 CodexEntry.exe / Codex.lnk，保留所有外部快捷方式 |

识别使用官方包路径或准确的 Store 应用身份，不会仅凭文件名替换其它软件，也不丢弃自定义文件/深链参数。Store 自身的注册入口、其它用户/公共桌面入口与任务栏固定数据不直接改写；任务栏请手动取消旧固定项后固定新的壁纸入口。已保存的模式会用于后续启动和升级。

从替换模式改选专用模式时，安装器先按备份恢复未被你另行修改的原快捷方式，再创建专用入口。

### 恢复被替换的原快捷方式

在 PowerShell 7 中运行以下命令；自定义安装时将 `$root` 改为自己的数据目录：

```powershell
$root = Join-Path $env:LOCALAPPDATA 'CodexWallpaperBridge'
$script = (Get-Content -LiteralPath (Join-Path $root 'launch-script.txt') -Raw).Trim()
& (Join-Path (Split-Path -Parent $script) 'Restore-Shortcuts.ps1') -Root $root
```

恢复前会核对原备份和当前快捷方式哈希；你后来改过的快捷方式会保留并提示，不直接覆盖。恢复同时关闭后续启动的自动替换。需要额外的壁纸入口时，再以 `-ShortcutMode separate` 运行安装器。

## 系统和可选软件

- **Windows 10/11 x64**，官方 Microsoft Store 版 Codex。
- **WinGet**：用于自动安装缺失依赖。若提示找不到 WinGet，在 Microsoft Store 安装或更新“应用安装程序 / App Installer”，再双击安装。
- **Wallpaper Engine**：浏览其壁纸库和使用“原版兼容”时需要；导入普通图片/视频不需要。先在 Steam 安装，并至少运行一次以完成初始化。
- **Chrome 或 Edge**：仅“网页浏览器（试验）”需要，使用本机已安装的浏览器。
- **GitHub CLI**：仅可选的系统音乐组件准备需要，基础安装不需要。

## 安装位置

默认数据目录：

```text
%LOCALAPPDATA%\CodexWallpaperBridge\
  CodexEntry.exe          一体启动入口
  Repair.cmd              手动恢复入口，不依赖自动更新任务
  Codex.lnk               带官方图标的快捷方式
  launcher-runtime.json   已检测到的依赖路径
  launch-script.txt       当前安装版本的位置
  settings.json          首次运行后生成的壁纸库和设置
  media\                 本项目管理的壁纸副本
  engines\               GPU / 音乐组件
  capture-cache\         Python / 原版采集依赖缓存
  versions\release-...\  按发布清单区分的程序版本
```

程序会复制到安装目录。安装成功后，下载的 ZIP 和解压文件夹可以移走；不要移动正在使用的安装目录。升级时重新下载、解压并运行 `Install.cmd`，继续使用原数据目录。安装器保留旧版本，不自动清理你的数据。

## 更新后壁纸消失：手动恢复

自动重连失败后仍可手动恢复。手动启动走普通入口，不读取自动任务的“该版本已尝试”限制。

1. **先重新点一次壁纸入口。** 专用模式用 Codex Wallpaper，替换模式用原名称的 Codex；如果只是壁纸宿主断开，入口会检查并补接。
2. **仍无壁纸时，保存内容并正常退出 Codex。** 关闭全部窗口，并从应用退出菜单结束仍在后台的实例。不要在任务管理器中强制结束来代替正常退出。
3. **运行安装目录的 `Repair.cmd`。** 默认位置可按 `Win + R` 输入 `%LOCALAPPDATA%\CodexWallpaperBridge\Repair.cmd`。自定义安装时使用自己选择的数据目录。确认已正常退出后按键，工具会通过 `CodexEntry.exe` 重新识别当前包并启动。
4. **入口丢失也能恢复。** 同一数据目录中的 `CodexEntry.exe` 和 `Codex.lnk` 均为稳定入口，不依赖桌面快捷方式或自动任务。
5. **依赖/安装文件缺失时重新安装。** 下载 Release 安装包，运行安装器并选择原数据目录；壁纸库和配置会保留。若新版客户端改变了接入方式，使用兼容该客户端的新版桥接程序。

手动恢复不重置设置、不删除素材、不消费自动重连次数，不修改官方包或 CSP。`Repair.cmd` 只提示你先自行退出，然后打开原一体入口，不负责自动关进程。错误可查看数据目录中的 `entry-error.log` 和 `launch-status.json`；分享前隐藏个人路径和内容。

### 更换安装盘

在解压目录的 PowerShell 7 中运行：

```powershell
./windows/Install-Wallpaper.ps1 -DataDirectory 'D:\CodexWallpaperBridge'
```

这会安装到指定目录并生成指向它的快捷方式。后续升级仍传相同目录。已有安装的库迁移请使用[备份和恢复](MAINTENANCE.zh-CN.md)，不要直接覆盖其它安装的设置。

## 首次设置壁纸

1. 从安装时选择的壁纸入口打开客户端，点击顶部 **壁纸**。
2. 普通图片/视频：点击 **导入图片 / 视频**，选择文件；支持 JPG、PNG、WebP、GIF、MP4、WebM。
3. Wallpaper Engine：点击 **搜索 Wallpaper 壁纸 / 图片 / 视频**。默认搜索已发现的壁纸库；未发现时，将范围改为 **自选文件夹**，选择包含 `project.json` 的项目目录或它的上级库目录。
4. 点击缩略图预览，选择 **导入当前项并应用**，或 **仅保存当前项**。勾选多张后可 **批量保存**，保持当前背景。
5. 在 **我的壁纸** 中浏览已保存的项目，点击 **确定切换** 才应用。

无需手写 JSON。分辨率、FPS、渲染方式、玻璃、字体、点击特效和轮播都在内嵌面板调整并保存。

| 使用目标 | 在面板中选择 |
| --- | --- |
| 常规使用 | 先用默认 1280 宽、24 FPS；按效果和占用调整 |
| 更清晰 | 选择 1920 / 2560 / 4K；4K 输出为 3840×2160 |
| 场景直接渲染 | GPU 场景（WebGL），在沙箱中运行场景 |
| 使用原引擎效果 | 原版兼容，需要 Wallpaper Engine |
| 自定义透明与阅读效果 | 玻璃、字体与特效；分别调整透明度、遮罩和亮度 |
| 自动切换 | 壁纸轮播，选择间隔、顺序和素材 |

视频按文件读取，支持几百 MB 或数 GB 的素材；准备播放副本仍需要磁盘空间。GPU 场景和图片有各自的资源预算，具体见[大文件说明](LARGE-MEDIA-20261027.zh-CN.md)。

## 可选：系统音乐和音频响应

基础安装不会读取系统播放器信息。需要此功能时，在解压目录的 PowerShell 7 中运行：

```powershell
winget install --id GitHub.cli --exact --source winget
```

安装后重新打开 PowerShell 7，回到解压目录，运行：

```powershell
gh auth login
node ./tools/prepare-media-bridge.mjs
```

若基础安装用了自定义数据目录，先执行 `$env:CODEX_WALLPAPER_DATA_DIR='D:\CodexWallpaperBridge'`，再运行准备命令。然后在壁纸面板 **系统音乐联动** 中启用歌曲显示或壁纸音频响应，点击保存。详见[音乐联动说明](SYSTEM-MEDIA.md)。

## 可选：更新后一次重连

安装时选 `y` 即可启用；无需再手动执行本节命令。每次从壁纸入口启动都会重新识别当前注册包。事件任务用于处理更新直接重开客户端、未经过壁纸入口的情况；只在未来更新后尝试一次正常关闭/重连，不用于平常启动时重启客户端。失败后按上面的手动恢复流程处理。

在 PowerShell 7 中运行：

```powershell
$root = Join-Path $env:LOCALAPPDATA 'CodexWallpaperBridge'
$script = (Get-Content -LiteralPath (Join-Path $root 'launch-script.txt') -Raw).Trim()
& (Join-Path (Split-Path -Parent $script) 'Install-UpdateReconnect.ps1') -Root $root
```

自定义安装时将 `$root` 改为你的数据目录。这会注册更新事件任务，只在后续更新时尝试一次正常重连，不增加自有常驻监控。移除时为同一命令加 `-Uninstall`。详见[更新重连说明](AFTER-UPDATE-RECONNECT.zh-CN.md)。

## 安装失败怎么处理

| 提示或现象 | 处理 |
| --- | --- |
| 官方 Codex 包未安装 | 先安装 Microsoft Store 官方版，运行并登录后重试 |
| 找不到 WinGet | 在 Microsoft Store 安装/更新 App Installer；或按下方命令手动准备依赖 |
| 网络下载失败 | 恢复网络后重新运行安装器；已有设置和旧版本会保留 |
| 发布文件校验失败 | 重新下载并解压到干净目录；不要在其中放个人文件或修改源码后直接安装 |
| 同名快捷方式指向其它程序或安装目录 | 重命名或自行移除旧的同名快捷方式后重试；安装器会保留无关入口，不直接覆盖 |
| 普通 Codex 正在运行 | 保存内容并正常退出，再打开 Codex Wallpaper；不用反复点击启动 |
| 找不到自装的 Node / PowerShell / FFmpeg / uv | 使用下方环境变量指定完整可执行文件路径，再运行安装器 |
| 任务栏打开的仍是普通客户端 | 取消旧固定项，将安装器生成的 Codex Wallpaper 固定到任务栏 |
| Windows 阻止运行下载的脚本 | 核对下载来源和文件后，在文件属性中解除阻止；企业策略限制需由管理员处理 |

手动准备依赖（运行安装器也会自动执行这些安装）：

```powershell
winget install --id Microsoft.PowerShell --exact --source winget
winget install --id OpenJS.NodeJS.LTS --exact --source winget
winget install --id Gyan.FFmpeg --exact --source winget
winget install --id astral-sh.uv --exact --source winget
```

安装后重新打开终端，再运行 `Install.cmd`。若不使用 WinGet，可自行从各项目官网安装，随后在 PowerShell 7 中设置实际路径；以下路径为配置示例，需替换成你已安装的文件：

```powershell
$env:CODEX_WALLPAPER_PWSH = 'D:\Tools\PowerShell\7\pwsh.exe'
$env:CODEX_WALLPAPER_NODE = 'D:\Tools\nodejs\node.exe'
$env:CODEX_WALLPAPER_FFMPEG = 'D:\Tools\ffmpeg\bin\ffmpeg.exe'
$env:CODEX_WALLPAPER_UV = 'D:\Tools\uv\uv.exe'
./windows/Install-Wallpaper.ps1 -SkipDependencyInstall
```

安装器会记录这些路径，无需把它们永久加入系统 PATH。

## 高级命令

```powershell
# 只检查，不安装依赖、不创建快捷方式、不启动客户端
./windows/Install-Wallpaper.ps1 -CheckOnly

# 只使用已经安装的依赖，缺失即报错
./windows/Install-Wallpaper.ps1 -SkipDependencyInstall

# 不创建桌面/开始菜单入口，仍生成数据目录内的入口
./windows/Install-Wallpaper.ps1 -NoShortcuts

# 已自行准备渲染运行时的离线部署，跳过组件下载
./windows/Install-Wallpaper.ps1 -SkipDependencyInstall -SkipPreparation
```

`-CheckOnly` 缺少依赖时退出码为 2，安装失败为 1，成功为 0。`-SkipPreparation` 不会准备缺失的渲染组件，不适用于首次完整安装。

## 升级、备份与卸载

- **升级**：下载新版本并重新双击安装；自定义安装盘时继续传相同 `-DataDirectory`。
- **备份**：使用[本地维护](MAINTENANCE.zh-CN.md)中的完整库备份/恢复；外观预设 JSON 只保存外观。
- **停用**：正常退出 Codex 后，使用原来的官方入口启动。
- **卸载**：先备份需要的内容；若用过替换模式，先恢复原快捷方式。移除自己安装的更新任务，正常退出客户端，删除自己创建的壁纸快捷方式，再手动删除本项目数据目录。不会要求卸载 Node、PowerShell、FFmpeg 或 uv，它们可能被其它软件使用。

不要在 Issues 中上传整个数据目录、settings.json、账号 profile 或未经脱敏的日志。
