# 更新后壁纸消失、启动自检与网页优先方式

## 根因与覆盖范围

**Error：** 26.1021更新到26.1023后壁纸消失，当前主实例没有9335调试参数，原壁纸宿主已退出。

**Expected：** 每次启动自动识别当前安装版本，沿同一入口恢复已有配置与壁纸。

**Cause：** 本机20:42:13（America/New_York）的AppX部署记录包含RegisterByPackageFamilyName、ForceTargetApplicationShutdownOption及RegisterHighestVersion；更新注册成功后20:42:15由sihost激活新包并创建当前主PID18600，绕过CodexEntry。GetApplicationRestartSettings对该实例只读查询成功，args为空、flags=3；只读包内启动文件同样显示客户端主动以空参数登记Windows restart。原来传入的CDP参数没有进入这条更新重启链。任务栏实际固定项已指向CodexEntry，本次不能误归因为任务栏仍是官方入口。

另发现开始菜单的ChatGPT快捷方式仍指旧26.1016包，确实存在普通启动绕过入口的缺口。它与更新自动激活是两条不同的路径。

**Fix：** 原一体入口每次均经过PowerShell bootstrap的当前注册包检查，移除绕开该检查的C#快速唤回路径；健康客户端与宿主仍复用，不重复加载壁纸。新增entry-health.json记录本次版本/包、上次成功版本、版本变化、客户端模式、下一步动作及快捷方式处理结果。失败不覆盖上次成功版本。当前客户端已正常运行但无CDP时保留它，并明确提示正常退出后从同一入口打开，不再提示不存在的“确认重新连接”入口。

**Prevention：** 每次入口启动检查桌面、开始菜单与固定项中名为Codex/ChatGPT的无参数官方Codex快捷方式，先备份原字节，再统一到已有CodexEntry与原官方图标。含文档/协议参数的快捷方式、其它同名应用不处理。重复执行不再改写；失败记录错误，不阻断壁纸启动。现有一体入口路径、图标、数据目录及运行时绝对路径保留。

f3a2cc1阶段只覆盖经过统一入口的启动。Windows更新直接激活AUMID、官方登录startupTask或直接exe启动仍可能绕过它；该阶段没有增加事件任务、IFEO、登录项或监控来冒充自动恢复。Windows RegisterApplicationRestart只能登记调用者自身，桥无法用公开写入API替当前Codex补上重启参数。[RegisterApplicationRestart](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-registerapplicationrestart)、[MSIX更新后的重启](https://learn.microsoft.com/en-us/windows/msix/non-store-developer-updates)。

后续用户已授权仅更新后尝试一次正常重连，已安装[事件驱动的一次性规则](AFTER-UPDATE-RECONNECT.zh-CN.md)，没有常驻自有监控进程。没有补触发当前会话，也没有承诺未来所有私有UI接口自动兼容或“免疫更新”；自然更新的完整恢复仍待验收。

## 网页流畅度与优先设置

同一个生成的本地canvas动画，在1280×720、30 FPS、JPEG92规格下对比WE专用离屏窗口采集与无窗口Chromium，各只采4秒，不接当前Codex。

| 指标 | 原版WE | Chromium网页 |
|---|---:|---:|
| 首张JPEG返回 | 4.67秒（黑底加载帧） | 1.80秒 |
| 完整4秒提交/独特JPEG | 79 / 78 | 73 / 73 |
| 相同末2.5秒独特JPEG/s | 30.4 | 18.8 |
| 末段帧间隔P95 | 50.46ms | 77.16ms |

WE启动慢且首张是加载黑帧，首个明显动画约启动6.67秒。末2.5秒是看过初始化空窗后选取的探索性子区间，不能推广所有网页，也不是Codex物理屏幕呈现帧率。该样本支持当前实现优先WE取得较稳的连续输出，Chromium则首张更快且仍为兼容有限的试验通道。

按本次用户要求，持久保存rendererPriority={scene:webwallgl,web:native}。自动导入Scene优先GPU直绘，Web优先原版；选择器简明显示两类优先路线，手动Chromium选择仍可用。已有保存版本、当前选中壁纸不自动迁移。配置只增加这个优先字段，其余字段与13条库逐项一致。系统音频与完整作者效果也使原版更适合作为当前默认兼容路线，不将“GPU”标签当作跨路线的普遍流畅度保证。

## 验证、部署及剩余验收

- 启动决策、成功历史不被失败覆盖、旧链接范围、原字节备份及幂等的生成fixture检查通过；旧/新客户端保留策略检查通过。
- 新C#入口编译成功。独立构建目录及实际部署入口分别以空PATH执行--check-runtime，均识别26.1023并通过；只读检查未更改launch-status身份或客户端主进程。它们不是正常冷启动/真实壁纸采用验收。
- 10项相关预检/导入/网页动作测试及面板定向隔离检查通过；没有扩大为全量无关回归。
- 实际入口exe已备份替换，官方图标与原一体快捷方式/运行时配置路径相同；旧开始菜单快捷方式已备份修复。当前CodexPID18600身份未变，无自有宿主、监控或任务被启动。
- 当前launch-script.txt明确使用仓库windows启动脚本。运行目录app/windows存在与Git不一致的旧副本，部署预检先停止；未覆盖这些非活动副本，实际源码入口与新exe组合已核验。四个src运行模块已同步，40个src逐字节一致。
- 两个性能源的自有窗口/helper/browser均退出，WE桌面配置和测试期间的settings哈希相同；正式设置优先字段后配置校验确认其余内容相同。私有构建、备份、逐帧时间戳/哈希及部署结果位于仓库外../startup-update-work/，不提交exe、壁纸、官方源码、profile或私人配置。

仍待：用户正常退出后从一体入口启动的新版真实采用/可见验收；更新服务直接重开场景的经授权重连方案；原客户端browser内存增长归因。大场景文件传输提速实现保持不变。
