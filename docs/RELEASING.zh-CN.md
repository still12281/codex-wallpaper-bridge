# 构建安装资产

每个公开版本使用独立标签及不可变的 EXE、ZIP 和引导脚本。先完成源码检查并提交，再从该提交归档；公开后不要覆盖同一版本的资产，应增加新版本号。

1. 更新 `package.json` 版本及用户文档中的固定版本 URL，完成相关测试、发布清单和隐私检查。
2. 在独立输出目录生成 `CodexWallpaperBridge-<version>.zip`，归档前缀必须为 `CodexWallpaperBridge/`；生成同名 `.zip.sha256`。
3. 运行 `node tools/create-bootstrap.mjs --archive <ZIP完整路径> --output <输出目录>/install.ps1`。生成器读取当前版本、计算 ZIP 的原始 SHA256，把版本与摘要写入模板，并生成 `install.ps1.sha256`。模板不包含自身 ZIP 摘要，避免循环依赖。
4. 将同一 ZIP 解压到独立源码目录，用 Inno Setup 7 编译 EXE：`./tools/build-installer.ps1 -SourceDirectory <解压后的CodexWallpaperBridge目录> -OutputDirectory <独立输出目录> -CompilerPath <ISCC.exe路径>`。构建工具先检查发布清单，生成 `CodexWallpaperBridge-<version>-Setup.exe` 及其 `.sha256`。输入目录必须是完整源码归档，不能包含 `.git` 或 `node_modules`。
5. 同一 Release 提供六项资产：EXE、EXE SHA-256、ZIP、ZIP SHA-256、`install.ps1`、脚本 SHA-256。目标必须为已核对的完整提交 SHA，Release 的主要下载指向 EXE。
6. 回读资产并逐一校验，核对生成脚本中的 ZIP 摘要。发布后以无 GitHub 登录凭据的请求下载，执行脚本 `-CheckOnly` 验证真实下载/校验/解压/安装检查链；核对公开 EXE 摘要。

EXE 使用稳定 AppId 和当前用户安装范围。构建/验证时禁用自动关闭及重启客户端。用独立程序与数据目录检查实际安装、再次安装、Windows Apps 注册和卸载；检查个人数据保留、安装失败停止，以及未知或已修改集成的保留。快捷方式归属检查可运行 `./test/uninstall-shortcuts.ps1`。

自动化安装支持 `/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR="<程序目录>" /DATADIR="<数据目录>" /SHORTCUTMODE=ask|separate|replace|none /UPDATE=keep|enable|disable /LOGIN=keep|enable|disable`。`/SKIPPREPARATION=1` 供已准备渲染组件的开发环境使用，首次完整安装应保留默认准备流程。升级沿用已登记的数据目录，迁移通过备份恢复完成。

`tools/install-bootstrap.ps1` 是源码模板，不能直接作为远程入口。生成后的脚本调用现有 `Install.cmd`，下载缓存保留便于排错；不增加服务、更新轮询或自动关闭客户端。发布为 alpha 时保持 prerelease 标记，文档使用固定标签链接，不依赖 GitHub 的 latest 选择规则。
