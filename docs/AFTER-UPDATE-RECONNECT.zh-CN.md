# 自动更新恢复

启用后，Windows 在 Codex 新版安装登记完成时触发恢复任务。任务核验更新事件和客户端身份，恢复壁纸连接并退出。每个新版本处理一次。

## 触发条件

安装时记录当前注册的 Codex 版本、最新部署事件编号和启用时间。任务只处理此后到达的当前用户、当前官方包的新版本注册事件；事件有效期为 120 秒。旧事件、同版本重复注册、其它应用或用户的事件直接跳过。

Windows 事件任务名为 `CodexWallpaperBridge-AfterUpdate-<当前用户SID>`，收到 AppX 注册完成事件后延迟 8 秒运行原 `CodexEntry.exe`。任务按事件运行，没有定时触发或重复触发器；处理完成后退出。

## 收到事件后做什么

| 客户端状态 | 执行动作 |
| --- | --- |
| 新版已有健康 CDP 连接和新鲜的壁纸宿主状态 | 保留现有连接，结束任务 |
| 更新创建的新版实例已有 CDP，壁纸宿主未恢复 | 调用统一入口补接宿主，保留客户端 |
| 更新事件附近创建了唯一的当前包主实例，且未开放 CDP | 核验 PID、会话、完整创建时间和路径，发送一次正常关闭请求 |
| 关闭后确认进程退出 | 从统一入口启动当前登记包，带上壁纸连接参数并恢复保存的壁纸 |
| 关闭被拒绝，或 20 秒内未确认退出 | 保留客户端，记录结果并结束任务 |
| 出现新的主实例、多份实例，或身份核验失败 | 保留客户端，记录结果并结束任务 |
| 后台更新时没有客户端 | 结束任务，保持客户端关闭 |
| 统一入口正在处理另一次启动 | 记录忙状态并结束任务 |

发送关闭请求前，会再次核对安装包、事件时效和进程身份。更新模式只调用一次 `CloseMainWindow`，不使用强制终止。进程暂时读不到路径时，补查原生身份并在原 20 秒期限内等待；再次查询确认进程消失后才继续启动。

版本号在执行动作前写入 `update-reconnect.json`。同版本后续事件不再执行，失败结果也保留在该文件中。自动入口启动后，后续步骤保留已核验的客户端，不再次关闭或改用另一条启动路径。

任务沿用 `launcher-runtime.json` 的运行路径、原数据目录和官方客户端 profile。任务交接统一入口的等待上限为 110 秒。任务计划程序的执行时限为 3 分钟，`AllowHardTerminate=false`。

## 自动任务结束后如何手动恢复

保存工作并正常退出 Codex，然后点击原壁纸入口，或运行数据目录内的 `Repair.cmd`。手动入口独立于自动任务的版本记录，重新识别当前登记包，保留壁纸库和设置。

刚退出就点击入口时，入口会等待旧进程收尾，再继续本次启动。初次扫描和退出等待都处理路径暂时不可读的情况；已核验的辅助进程按辅助进程规则处理。仍活跃的主实例和无法核验的实例会被保留。

## 验证记录

| 检查 | 截至 2026-11-06 的结果 |
| --- | --- |
| 新版、重复、过期、其它用户和其它应用事件的过滤 | 通过 |
| 完整执行器的关闭交接、宿主补接、健康连接保留、后台更新、新实例保留、同版本去重 | 生成环境检查通过 |
| 路径暂时不可读、PID/创建时间/会话变化、自然退出子进程、超时保留 | 通过 |
| Windows 任务 XML、主体身份、原生入口运行路径、历史事件拒绝 | 通过 |
| 本机正常退出后，立即从原任务栏入口单击打开并恢复主/分离窗口壁纸 | 实机通过 |
| 本轮修复后的下一次 Microsoft Store 自然更新到壁纸恢复全流程 | 未执行 |

## 启用、查看和停用

安装时选择启用更新恢复即可。已有安装使用 `windows/Install-UpdateReconnect.ps1 -Root <数据目录>` 启用；`-InspectOnly` 验证任务定义；`-Uninstall` 移除任务。以上命令不关闭当前客户端。

在 PowerShell 中查看当前用户的任务：

```powershell
$rule='CodexWallpaperBridge-AfterUpdate-'+[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
Get-ScheduledTask -TaskName $rule
Get-ScheduledTaskInfo -TaskName $rule
```

`Disable-ScheduledTask -TaskName $rule` 停用，`Enable-ScheduledTask -TaskName $rule` 重新启用。移除任务保留壁纸和客户端。任务主体显示为账号名时，安装器会先解析为 SID 再核对。

Windows 机制参考：[事件触发器](https://learn.microsoft.com/en-us/windows/win32/taskschd/eventtrigger)、[事件参数](https://learn.microsoft.com/en-us/windows/win32/taskschd/taskschedulerschema-valuequeries-eventtriggertype-element)。
