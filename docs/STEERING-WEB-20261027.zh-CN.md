# 侧边聊天中的横栏问题与后续网页通道

用户所指问题来自当前页面“侧边聊天”的对话内容：运行中引导横栏没有跟随壁纸，以及GPU/WebGL名称造成的性能路线疑问。本轮先定位对话，再处理具体组件；没有将其误当成侧边栏本身的底色问题。

## 横栏遗漏与修复

当前26.1021.3705.0客户端的 `app-initial-438d1df57f70.js` 中，Composer rail给每个条目设置 `data-composer-rail-item`，默认条目另带 `bg-surface-elevated-secondary`。旧适配只处理外层 `data-composer-rail` 与utility rail，默认条目仍落在较不透明的elevated背景。独立above-composer fixed surface也使用自己的中性背景。

本项目CSS补齐默认中性条目及已核对结构的floating中性横栏，并纳入现有壁纸颜色/玻璃浓度。警告分支使用不同的warning mix类，本次没有覆盖其语义颜色；布局、焦点和提交行为不变。

隔离light/dark检查通过，按钮几何不变、warning仍原色。当前Codex主/分离页按原组件属性和class构造的隐藏样式样本分别得到rgba(7/8,7/8,7/8,0.5)，warning保持rgb(180,100,10)。这是实际客户端CSS/主题计算检查；本轮没有发送引导消息来制造运行态横栏，不能替代横栏自然出现时的真实视觉验收。

## GPU 与 WebGL 的命名

当前所谓“GPU场景（DSH）”本身就是WebGL直绘，不是另一条独立于WebGL的GPU引擎。本轮将导入、渲染选择及预览统一为“GPU直绘（WebGL）”，自动选项明确“场景优先GPU”。

已有自动路由保持：Scene优先WebGL，网页走原版兼容，视频/图片直接播放。没有改变已保存渲染偏好，也没有声称仅凭标签可以证明所有场景的帧率高低；特效、纹理预算、输出尺寸和具体场景均会影响表现。

## 当前终端版本适配

同时发现终端主题adapter仍仅支持旧 `app-initial-ad16eaadf81f.js/f3t`，当前主页面已加载438d版本，其manager是 `Lrt`。只读核对包内定义/导出并在当前页面回读公开manager方法后，增加精确版本映射，保留旧版和未知版本安全回退；未读取PTY或终端buffer。

主页面状态已由unsupported恢复为adapted，当前terminal数为0，未打开真实终端做视觉验收。分离页没有加载支持的terminal模块、也没有xterm，保持unsupported原生后备，这不是强制猜测其它导出的理由。

## 部署与证据

六个运行模块已在仓库外备份并部署，先热更新样式/控件，再仅重载自有宿主20996→46448，保证后续新页面使用新函数。主/分离面板v20、背景ready，38个src模块一致；13条库、设置字节与Codex browser identity相同。未改官方客户端/CSP、未前置或重启Codex、未新增常驻诊断。

首个部署校验把分离页也断言为terminal adapted而失败；随后查明它没有terminal模块，改按实际页面能力分别报告，没有修改未知客户端来凑全绿。真实能力记录见仓库外 `../steering-web-work/native-result.json`。相关12项单元与面板定向检查通过，数据在 `panel-result.json`。

本轮REA MCP未连接，现有CLI不支持技能所述source-path参数，其语义分析又缺少Windows native controls build manifest。没有修工具配置或安装依赖；只读ASAR目录/选定界面文件与运行时DOM用于定位，REA结果仅保留部分inventory Evidence，不能当完整语义分析成功。包索引、选定源哈希和失败证据均在上述仓库外目录，不随发布分发客户端源文件。

## 网页通道的下一步

正在限定独立headless Chrome → Page.startScreencast JPEG → 现有Node/CDP canvas的试验，避免创建屏幕窗口，也不改Codex CSP。只使用独立profile、fixture资源与opaque作者iframe，不连接当前Codex。试验结束后记录首帧、相对资源、暂停恢复、ACK和清理结果；未通过恢复与生命周期边界前不接入正式网页模式。
