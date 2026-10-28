# 构建远程安装资产

每个公开版本使用独立标签及不可变的 ZIP 和引导脚本。先完成源码检查并提交，再从该提交归档；公开后不要覆盖同一版本的资产，应增加新版本号。

1. 更新 `package.json` 版本及用户文档中的固定版本 URL，完成相关测试、发布清单和隐私检查。
2. 在独立输出目录生成 `CodexWallpaperBridge-<version>.zip`，归档前缀必须为 `CodexWallpaperBridge/`；生成同名 `.zip.sha256`。
3. 运行 `node tools/create-bootstrap.mjs --archive <ZIP完整路径> --output <输出目录>/install.ps1`。生成器读取当前版本、计算 ZIP 的原始 SHA256，把版本与摘要写入模板，并生成 `install.ps1.sha256`。模板不包含自身 ZIP 摘要，避免循环依赖。
4. 将 ZIP、ZIP 校验文件、`install.ps1` 和脚本校验文件作为同一 Release 的四项资产上传；目标必须为已核对的完整提交 SHA。
5. 回读资产并逐一校验，核对生成脚本中的 ZIP 摘要。发布后以无 GitHub 登录凭据的请求下载，执行脚本 `-CheckOnly` 验证真实下载/校验/解压/安装检查链，不为验收关闭客户端。

`tools/install-bootstrap.ps1` 是源码模板，不能直接作为远程入口。生成后的脚本调用现有 `Install.cmd`，下载缓存保留便于排错；不增加服务、更新轮询或自动关闭客户端。发布为 alpha 时保持 prerelease 标记，文档使用固定标签链接，不依赖 GitHub 的 latest 选择规则。
