# 更新后的一次性正常重连

用户已明确授权：仅在更新后，自动尝试一次正常关闭并重新接入；不强制结束，不做常驻监控。这个授权不用于补触发安装前的更新，也不允许因失败而反复重启。

## 已启用的行为

注册当前用户的Windows事件任务`CodexWallpaperBridge-AfterUpdate-<当前用户SID>`。它由AppX部署日志的注册完成事件唤醒，延迟8秒；没有定时、登录、开机或重复触发器，没有常驻自有检测进程。任务通过原CodexEntry.exe隐藏运行一次检查，处理完退出；已有壁纸宿主仍按原设计随客户端运行。

安装时以当前注册版本26.1023.6123.0和日志事件78483建立起点。旧事件、同版本重复注册、其它用户/应用、非当前包、超过120秒的事件全部跳过。版本在任何关闭动作前持久标记为已消费；关闭失败或后续接入失败也不再重试该版本。后台更新时若没有客户端，不主动打开它。

若新版客户端已有健康CDP和新鲜壁纸宿主，直接跳过。若只有CDP、宿主未恢复，可调用原bootstrap补接宿主，不关闭客户端。只有事件附近创建、当前会话、当前包路径的唯一主实例才可能被请求关闭。发送请求前重新验证当前安装包、事件时效、PID、原生创建时间与完整路径。

更新路径只调用一次`CloseMainWindow`普通关闭请求，然后最多等待20秒。拒绝关闭、超时、出现新的客户端实例均停止并保留客户端，没有Kill、taskkill或强制结束回退。若正常退出，原bootstrap的专用`AfterUpdate`模式仅直接启动一次已验证Store可执行文件并恢复原配置；该模式禁止再次关闭客户端，禁用“关闭新实例后换启动方式”和失败后再开普通实例的回退。

手动入口与更新任务共享bootstrap互斥锁；忙则跳过。任务自身忽略并发重复启动，安装/卸载也与执行共享独立互斥锁。运行路径从原launcher-runtime.json读取，数据目录沿原一体入口传递，不依赖计划任务PATH或改为新profile。

## 稳定性与边界

这是有边界的自动恢复，不是更新免疫。规则能处理已核实的“包更新直接重开时丢失调试参数”模式；未来若Codex更改调试入口、CSP、页面结构、包名或Windows事件格式，仍可能不适用。规则只尝试，不保证每次恢复成功。

尤其是`CloseMainWindow`可能被客户端解释为关闭/隐藏窗口而不是完全退出。未退出时会停止，不强制杀掉后台实例；此时仍需用户正常退出并从原入口打开。另一种Windows Restart Manager退出方案未取得可靠的正常退出标记证据，已撤回且不在已启用代码内。

任务定义保留在Windows计划任务中，空闲状态是Ready；它不是一个常驻程序。执行时间设置为3分钟并禁止HardTerminate；该设置不等于保证能强制终止一个系统层面挂起的操作。业务逻辑没有无限等待/轮询，关闭等待20秒、bootstrap交接等待110秒，正常处理后即退出。Windows自身的任务服务与事件日志服务不是本项目新增进程。

## 验证

- 策略检查通过：新/旧/重复/过期/其它用户事件、后台更新不打开客户端、旧实例保留、关闭一次/拒绝/超时/新实例、任务非重复与无硬终止，以及真实bootstrap中央函数在AfterUpdate模式拒绝进一步关闭。
- 原生进程创建时间检查发现CIM截断到微秒，而Get-Process保留FILETIME的100ns精度；当前客户端实测相差8 ticks。现改为校验CIM与原生精度范围后，持有并再次比较原生完整身份，避免误拒绝同一进程。JSON日期往返也验证了安装基线的时区保持。
- Windows Task Scheduler的验证模式接受任务XML，实际任务已注册、当前用户InteractiveToken/LeastPrivilege、无重复触发、无HardTerminate；查询能匹配历史注册记录，任务未被手动运行，也未制造虚假的系统更新事件。
- 重编译一体入口并完成空PATH的只读运行环境检查。通过实际已部署exe传入历史事件78396，正确拒绝，执行后退出；规则状态与壁纸settings字节相同，Codex主PID18600及其创建时间相同，重连进程剩余0。
- 调试统计曾把诊断命令中包含的脚本名字计为“残留”，已改为检查真实`-File`启动参数，未为凑验证结果关闭任何进程。
- 当前规则为`armed-for-future-updates`，没有尝试补接当前已运行会话。真实的“下一次自然更新→正常退出→新版首帧恢复”仍待验收；隔离策略和历史回放不冒充完整更新验收。

安装/验证记录、原exe备份及私有结果位于仓库外`../startup-update-work/after-update-install/`。未提交任务中的用户SID、私人配置、exe、浏览器profile或官方客户端源文件。原官方图标、一体入口位置和壁纸库保留；这轮没有改变渲染规格、场景首切传输或rendererPriority。

## 查看和停用

新安装可在交互安装时选择启用。Windows 任务计划程序有时把主体从 SID 回显为账号名；安装/检查现有任务时会先解析到 SID 再核对，避免同一用户重复安装被误拒绝。只读的 `Install-UpdateReconnect.ps1 -Root <数据目录> -InspectOnly` 验证任务结构而不触发重连。

自动恢复失败不会封锁普通入口。保存工作并正常退出客户端后，运行数据目录的 `Repair.cmd`，或直接运行 `CodexEntry.exe`。手动启动不受自动任务已消费版本的限制，详见[手动恢复](INSTALL.zh-CN.md#更新后壁纸消失手动恢复)。

在PowerShell中查看当前用户规则：

```powershell
$rule='CodexWallpaperBridge-AfterUpdate-'+[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
Get-ScheduledTask -TaskName $rule
Get-ScheduledTaskInfo -TaskName $rule
```

停用下一次触发：`Disable-ScheduledTask -TaskName $rule`。重新启用：`Enable-ScheduledTask -TaskName $rule`。彻底移除可用`windows/Install-UpdateReconnect.ps1 -Root <现有数据目录> -Uninstall`；不修改壁纸或官方客户端。某次结果保存在数据目录`update-reconnect.json`，失败不会自动重试。

Windows机制参考：[事件触发器](https://learn.microsoft.com/en-us/windows/win32/taskschd/eventtrigger)、[从事件提取参数](https://learn.microsoft.com/en-us/windows/win32/taskschd/taskschedulerschema-valuequeries-eventtriggertype-element)。
