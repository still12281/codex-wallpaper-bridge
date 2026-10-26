# 本地备份、恢复与停用

以下命令使用绝对路径；示例的 `DATA_DIR`、`BACKUP_DIR`、`NEW_DATA_DIR` 需要替换为自己的路径。备份包含私有路径和素材，放在源码仓库外，不上传到 Git 或反馈附件。

## 完整库备份与恢复

```powershell
node tools/library-maintenance.mjs diagnose "DATA_DIR"
node tools/library-maintenance.mjs backup "DATA_DIR" "BACKUP_DIR"
node tools/library-maintenance.mjs restore "BACKUP_DIR" "NEW_DATA_DIR"
```

备份包含 settings、库记录、当前选择、用户偏好和所有被引用的应用内 media/staging 素材，包括静态保帧。应用内绝对素材路径转换为相对路径，恢复后可以迁移数据目录。外部图片/视频和 Wallpaper Engine 工坊项目只保存引用，需另外保留其原件。外观预设不包含这些数据。

备份/恢复目标必须为空，已有数据不会被覆盖；不删除原数据。恢复前验证相对路径、必需素材和 SHA-256；失败的目录不作为完成品，不直接启用。恢复到新目录后，设置 `CODEX_WALLPAPER_DATA_DIR`，重新构建入口，再正常退出并从新入口启动。工具不会替换当前运行会话。配置损坏时也采用最近有效备份恢复到新目录，保留损坏文件以供诊断。

## 外部项目移动

先用 diagnose 查看丢失的字段。原生/WebGL 项目移动后，在壁纸宿主停止时执行：

```powershell
node tools/library-maintenance.mjs relocate "DATA_DIR" "ENTRY_ID" "NEW_PROJECT_DIR"
```

新目录必须含匹配类型的 project.json；保留记录 ID 并更新项目引用，修改前另存一份 settings。工具拒绝修改有新鲜运行心跳的库。普通外部媒体可重新导入；原应用内播放副本仍在时，先保留原记录，确认新导入正常后再决定是否删除。暂未实现普通媒体原位重定位按钮。

## 停用、卸载与空间

临时停用：将背景切为静态或清空当前背景；完整停用可正常退出 Codex，再从官方入口打开。当前运行中的壁纸宿主不能通过卸载配置强行关闭 Codex。需要仅停止宿主时，核实 runtime-status.json 的 PID、Node 可执行文件和 video-cdp-host.mjs 命令行后定向停止该宿主；先换回图片/视频可让自有源窗口正常清理。

不再使用时取消固定壁纸入口，保留官方入口；若历史安装仍有 `CodexWallpaperBridge-Supervisor` 计划任务，单独停用该精确任务。完成备份、确认本项目的源窗口/采集助手已退出后，数据目录和本地编译入口可按需由用户清理。不要删除 Wallpaper Engine 安装、工坊原项目或官方 Codex 包。源码不会自动递归删除数据。

数据空间由 media/staging 副本、静态图、可选引擎、capture-cache 环境和历史备份组成。诊断先区分可重建缓存与唯一素材；当前尚无自动总容量清理策略。不要仅按文件日期或扩展名清理整个数据目录。

## 场景切换缓存

GPU 场景使用 Codex 自身 profile 内的专用 CacheStorage `codex-wallpaper-resources-v1`，总量最多 512 MiB、最多四项，单个资源最多 256 MiB；素材文件变化后重新加载。它是可重建的播放资源缓存，不是原素材，也不包含在 DATA_DIR 库备份中。

控制页“管理我的壁纸 → 清理切换缓存”仅清除此专用缓存，不删除 Wallpaper Engine 项目、不删除当前库记录、不改变当前画面。清理后下一次切换需重新填充。不要为清理它删除整个 Codex profile 或其它应用缓存。
