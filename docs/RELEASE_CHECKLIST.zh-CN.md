# 发布前信息清单

本轮只整理，不创建 GitHub 仓库、不推送、不发布 Release。候选暂定项目名与 MIT，不填写个人身份。

## 需要维护者确认

| 信息 | 候选内容 | 发布前动作 |
| --- | --- | --- |
| GitHub 仓库名 | `codex-wallpaper-bridge` | 确认名字与账号/组织归属 |
| 简介 | Windows Codex 桌面客户端的本地静态/动态壁纸与 Wallpaper Engine 库管理 | 可直接用于仓库 About；不夸大官方支持 |
| 公开署名 | contributors | 决定公开昵称；不必填写真实姓名 |
| 许可证 | 原创部分拟 MIT | 确认后发布；保留三份上游许可证 |
| 版本 | `0.1.0-alpha.0` | 明确实验状态和已知限制 |
| 反馈/维护 | 尚未设置公开联系人 | 决定用 Issues/Discussions，是否启用私有安全报告 |
| 截图/演示 | 本候选不附真实截图或素材 | 使用自制/获授权素材与空白演示聊天重新制作；先脱敏 |
| Git 提交身份 | 尚未初始化仓库 | 用公开昵称与 GitHub no-reply 邮箱；确认后再首次提交 |

建议 Topics：`codex`、`wallpaper`、`wallpaper-engine`、`windows`、`desktop-customization`、`electron`、`live-wallpaper`。

## 内容和隐私复核

- 只从本候选目录发布，不能把正在运行的程序目录整体上传。
- 保持数据目录在仓库外；不能附带 settings、profile、账号、壁纸、截图、日志、快捷方式或提取图标。
- 查看 `release-manifest.json` 和 `npm run check:privacy` 结果，再人工核对文件与后续 Git 历史；`.gitignore` 不是隐私保证。
- 上游许可证的原始署名/公开联系地址必须保留，不冒充维护者身份。
- 未提供自己的壁纸版权许可时，不随开源代码发布壁纸。源项目 MIT 也不代表素材、品牌图标或商业客户端获得同样授权。

## 质量复核

- `npm test`、`npm run check:privacy` 和可选的隔离集成测试通过。
- 复核 `docs/VALIDATION.md`，完成新机器/完整冷启动/任务栏入口的人工验收，或在首次 alpha 中明确写出未验证。
- FFmpeg 等依赖不捆绑；说明独立安装、信任边界与本地调试端口风险。
- 确认没有外部自动上传、遥测、真实数据夹具和运行时自动截图。

## 之后才执行

维护者明确确认发布范围、仓库位置、署名及许可证后，再初始化/提交、创建远程仓库和推送。不要把本地整理完成视为发布授权。
