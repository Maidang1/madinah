---
title: how pi computer works
pubDate: 2026-07-13T12:59:31.068Z
status: published
---
## 1. Computer Use 解决的问题

传统 Agent 最擅长调用 API、执行命令和读写文件：这些接口结构明确、结果易于校验。但现实中仍有大量任务只能通过图形界面完成——没有 API 的内部系统、只能点击的专业软件、需要人工确认的设置面板，以及由多个桌面应用串联而成的工作流。

Computer Use 为模型补齐了两类能力：

- hello world

- **观察**：获取屏幕图像、窗口信息或可访问性树；

- **行动**：执行点击、输入、滚动、快捷键等操作，并观察其结果。

而要从“能够点击”走向“可靠地完成任务”，还须回答四个工程问题：

1. 模型此刻依据的是哪一次观察？
2. 操作执行前，界面是否已被用户或另一条任务改变？
3. 一个“保存”动作，应该走语义 API 还是坐标输入？
4. 系统如何区分“事件已发送”与“业务结果已发生”？
5. Hello world

pi-computer-use 的核心价值正在于此：它把 Computer Use 从一个截图—坐标循环，扩展成一个具备**状态所有权、并发控制、渐进式披露和结果验证**的运行时。

项目 README 建议优先采用可靠的 API 或 MCP 集成，仅在图形界面确为主要交互入口时才使用 Computer Use。[项目 README](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/README.md#what-this-package-is-not)

---

## 2. 系统边界与整体架构

pi-computer-use 是一个 **Pi 扩展**，负责把 Agent 工具与桌面执行环境连接起来。整条桌面路径可分为三层：

```text
┌──────────────────────────────────────────────────────────┐
│ 第 1 层：Pi Agent 与扩展工具                                │
│ find_roots / observe_ui / search_ui / act_ui / ...       │
└──────────────────────────┬───────────────────────────────┘
                           │ 工具调用
┌──────────────────────────▼───────────────────────────────┐
│ 第 2 层：TypeScript 运行时                                │
│ 状态存储、ref 稳定化、资源调度、epoch、动作准备、结果视图  │
│ state.ts / runtime.ts / bridge.ts / actions.ts / view.ts │
└──────────────────────────┬───────────────────────────────┘
                           │ 平台协议
┌──────────────────────────▼───────────────────────────────┐
│ 第 3 层：平台后端与 Native Helper                         │
│ macOS: Swift + AX + ScreenCaptureKit + CGEvent           │
│ Windows: Rust + UI Automation + GDI + SendInput          │
└──────────────────────────┬───────────────────────────────┘
                           │ 系统 API
┌──────────────────────────▼───────────────────────────────┐
│ macOS / Windows 桌面会话                                  │
└──────────────────────────────────────────────────────────┘
```

浏览器页面还有一条并行路径：Pi 管理的页面通过 Chrome DevTools Protocol（CDP）接入，并被建模为同一棵“多根森林”中的 `browser_page` root，从而复用统一的观察与状态接口。[架构说明](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/docs/architecture.md#browser-support)

### 2.1 工具接口：通用 UI 与浏览器能力

当前扩展共注册了 11 个工具，其中 8 个用于通用 UI 操作，3 个用于浏览器上下文：[工具注册源码](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/extensions/computer-use.ts#L39-L199)

类别工具作用通用 UI`find_roots`发现窗口、菜单、对话框和浏览器页面通用 UI`observe_ui`观察一个 root，产生新状态通用 UI`search_ui`在完整缓存树中搜索通用 UI`expand_ui`局部展开被折叠或截断的区域通用 UI`inspect_ui`检查一个元素的字段、坐标和能力通用 UI`act_ui`执行一到多个有序动作通用 UI`read_text`分页读取长文本通用 UI`wait_for`等待文本或角色出现/消失浏览器`launch_browser`启动 Pi 管理的浏览器上下文浏览器`navigate_browser`直接导航浏览器页面浏览器`evaluate_browser`在 CDP 页面执行 JavaScript

### 2.2 为什么要有 Native Helper

原生 Helper 把操作系统相关的问题集中收敛在一条清晰的边界内：

- macOS 的 TCC 权限需要绑定到稳定的应用身份；
- AX、AppKit、ScreenCaptureKit、CGEvent 与 Windows UIA 的线程模型各不相同；
- 全局物理输入需要跨请求串行化；
- 各平台可以独立实现同一套状态、观察和结果契约。

macOS Helper 安装于 `/Applications/pi-computer-use.app`，TypeScript 通过 Unix Domain Socket 发送 JSON Lines 请求；Windows Helper 则由 TypeScript 作为子进程启动，通过 stdin/stdout 以 JSON Lines 通信。[macOS 客户端](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/src/platform/macos/helper.ts#L11-L20) · [Windows 客户端](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/src/platform/windows/helper.ts#L81-L135)

---

## 3. 核心状态模型

### 3.1 Root、`stateId` 与 `@e` ref

一次典型流程是：

```text
find_roots → observe_ui → search / expand / inspect → act_ui → successor state
```

- `@rN` 指向一个可观察的 root，例如桌面窗口或浏览器页面；
- 每次观察都会生成一个新的、不可变的 `stateId`；
- `@eN` 元素 ref 只属于产生它的那个状态；
- 后续的搜索、检查和操作都必须显式携带 `stateId`。

这意味着系统中并不存在一个可被并发请求随意覆盖的“当前页面”。每次调用都从指定状态出发，恢复自己的请求局部上下文。[状态模型源码](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/src/state.ts#L65-L119)

### 3.2 两层有界缓存

系统中有两个容易混淆的容量边界：

层当前上限保存内容淘汰后的影响TypeScript 状态存储128Agent 可恢复的完整不可变观察旧 `stateId` 不再可用Native Helper look 存储8原生定位与坐标变换所需的 look 记录旧 `lookId` 可能返回 `stale_look`

这两个容量值均属于当前版本的实现参数。状态存储按插入顺序淘汰，Native Helper 同样会在第 9 条 look 到来时移除最早的记录。[状态存储实现](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/src/runtime.ts#L17-L49) · [macOS look 淘汰](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/macos/bridge.swift#L1394-L1415) · [Windows look 淘汰](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/windows/bridge-rs/src/main.rs#L48-L82)

### 3.3 Progressive Disclosure：完整保存，按需展示

`observe_ui` 在内部保存完整的树，但默认只返回折叠后的概要。`search_ui` 在完整缓存树中检索，`expand_ui` 只展开局部，`inspect_ui` 则返回单个节点的详细证据。

这项设计主要用于控制 **Agent 的上下文成本**：模型无需每次都接收几千个节点，也不必为了找到一个按钮而重新截屏。只有当区域被截断或需要 OCR 时，局部操作才可能升级为一次新的实时观察。

### 3.4 Epoch：拒绝陈旧写入

TypeScript 运行时按物理资源建立 lane：

```text
desktop-pid:123  ── 串行处理同一应用进程的实时操作
desktop-pid:456  ── 与 PID 123 可并行
cdp:page-A       ── 按浏览器 target 串行
```

每个资源都有一个单调递增的 epoch。写操作执行前，会比较状态携带的 epoch 与当前 epoch，一旦不一致就抛出 `StaleResourceStateError`。epoch 在原生调用之前递增，因此即便底层执行产生了部分副作用后才报错，旧状态也不会再被当作安全的写入基础。[资源调度源码](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/src/runtime.ts#L52-L128)

从并发模型来看，它属于带版本号的乐观并发控制，与 CPU 层面的 Compare-And-Swap 指令并不相同。

---

## 4. 观察：AI 如何“看见”界面

### 4.1 一次桌面观察包含什么

桌面的 `observe_ui` 可以组合四类证据：

1. root 身份、窗口位置和缩放信息；
2. AX（macOS）或 UIA（Windows）元素树；
3. 可选的窗口截图；
4. 需要时附加的 OCR 文本框。

返回的坐标统一归一到 `window-relative-screenshot-pixels`。因此，坐标动作必须使用产生该图像的那次状态，不能把旧截图的像素坐标套用到新窗口上。

### 4.2 三种观察模式

模式默认图像策略文本策略适用场景`semantic`不附图（可用 `image` 覆盖）不做 OCR原生控件、追求低成本`visual`强制附图请求视觉文字证据自绘 UI、图片文字`fused`（默认）自动先使用语义树，必要时升级 OCR一般任务

当前 macOS Helper 使用 Vision 执行 OCR；Windows Helper 接受相同的模式字段，但 `readText.executed` 恒为 `false`，主要依赖 UIA 文本和截图。两端共享同一套观察契约，而视觉文字能力则保留平台差异。[观察模式映射](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/src/bridge.ts#L1737-L1760) · [Windows look 实现](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/windows/bridge-rs/src/main.rs#L300-L310) · [Windows OCR 状态](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/windows/bridge-rs/src/main.rs#L480-L490)

### 4.3 macOS 截图与 OCR

macOS 14 及以上优先使用 `SCScreenshotManager.captureImage` 捕获独立窗口。Apple 将 `SCScreenshotManager` 定义为单帧捕获接口，并标注适用于 macOS 14.0+。[Apple SCScreenshotManager 文档](https://developer.apple.com/documentation/screencapturekit/scscreenshotmanager)

实现会隐藏光标、忽略单窗口阴影；一旦捕获失败或超时，则回退到 `/usr/sbin/screencapture -x -l <windowId>`。截图可按最长边缩小，附图时以 0.8 质量编码为 JPEG。[macOS 捕获实现](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/macos/bridge.swift#L3041-L3160)

OCR 执行时，Vision 返回归一化的文本框，Helper 再将其换算到截图像素坐标：

- 与 AX 标签重复的文字被过滤掉；
- 落在已有 AX 节点内的文字，成为该节点的文本证据；
- 无法归属到任何 AX 元素的文字，成为 `pictureOnly` 节点，只能用于坐标定位。

每次观察都会返回 `captureMs`、`describeMs` 和 `readTextMs`。这些指标适合用来为目标环境建立性能基线——因为耗时会随机器配置、窗口大小、OCR 开关和应用的 AX 质量而变化。

### 4.4 Accessibility 树不是 DOM

Apple 对 `AXUIElement` 的定义是“指向 accessibility object 的结构”，该对象可提供层级关系、屏幕位置、角色和可执行动作。[Apple AXUIElement 文档](https://developer.apple.com/documentation/applicationservices/axuielement)

它与 DOM 同样采用树形结构，但 Accessibility 树在节点来源、生命周期和覆盖范围上都有所不同：

- 应用可能只暴露一部分 UI；
- 自绘画布、游戏和某些 Web 内容可能缺少有用的节点；
- AX 元素可能在重绘后失效；
- 同一个视觉控件不一定对应唯一、稳定的 AX 节点。

pi-computer-use 会保存角色、标题、值、能力和坐标，并借助 `AXVisibleChildren`、`AXVisibleRows`、`AXVisibleColumns`、`AXVisibleCells` 标记可见性。这能改善复杂列表的表达，但并不能保证在任何应用上都能得到完整、稳定的语义树。

---

## 5. 操作：从意图到可验证结果

### 5.1 `act_ui` 的真实执行链

```text
校验 stateId 与 epoch
        ↓
准备动作、解析 ref / 坐标、判断焦点依赖
        ↓
进入资源 lane
        ↓
后台语义尝试，必要且允许时升级前台输入
        ↓
Native Helper 执行动作并返回证据
        ↓
可选 expect 后置条件
        ↓
重新观察，保存 successor state，返回 diff 或完整视图
```

系统遵循“后台优先”原则，但不同动作采用不同策略：

- 原生按钮优先走 `AXPress` / UIA Invoke、Toggle 等语义模式；
- Web 文本输入在 macOS 上使用焦点 + 原子 Unicode 键盘事件；
- 原生文本框优先设置 AX/UIA value，再读回该值加以验证；
- 只有当点击或滚动的语义路径失败时，才可能升级为坐标和物理输入；
- 坐标输入前会做有限的遮挡预检，但这并非对所有语义动作都适用的通用遮挡证明。

整个动作系统用三组信息来描述执行过程：**grounding 表示目标如何定位，delivery 表示输入如何投递，verification 表示结果如何确认**。[macOS 动作实现](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/macos/bridge.swift#L1908-L2110)

### 5.2 `worked`、`didnt`、`unknown`

Helper 的结果分为三类：

- `worked`：已观察到足以支持“成功”判断的证据；
- `didnt`：有明确证据表明动作未达预期；
- `unknown`：事件可能已投递，但证据不足以断言成功或失败。

这三个值描述的是**证据强度**，而非业务事务的最终真相。例如，系统级输入 API 返回“事件已插入”，通常并不足以证明应用已经保存文件。

`act_ui.expect` 可以进一步要求某段文本、角色或精确值出现或消失。后置条件超时会把结果降级为失败，并返回 `postcondition_failed`。相比仅检查输入函数的返回值，这更贴近 Agent 真正需要的语义验证。[后置条件实现](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/src/bridge.ts#L1958-L2009)

### 5.3 有序多动作执行

`act_ui` 最多接受 20 个有序动作，但它没有回滚机制：前几步已产生的副作用，不会因后一步失败而被撤销。

- 允许前台 fallback 时，TypeScript 逐步执行，遇到 `didnt` 即停止；
- `headless: true` 且不含 `wait` 动作时，可下沉为一次 Native `actBatch`；
- Native batch 同样顺序执行、失败即停，并通过 `stoppedAt` 和部分 step 结果说明中断边界。

它提供的是同一资源上的有序动作边界：共享基础状态、顺序执行、失败即停、保留部分结果；其语义并不包含数据库事务式的回滚。[TypeScript 调度](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/src/bridge.ts#L1914-L1939) · [macOS batch 实现](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/macos/bridge.swift#L2113-L2155)

### 5.4 全局物理输入锁

macOS 使用 `NSRecursiveLock`，Windows 使用进程级物理输入锁，以确保目标聚焦、遮挡检查和 HID / SendInput 投递不会被另一个物理动作插入。语义层面的 AX/UIA 工作，在平台允许时仍可并发。

这把锁解决的是**本工具内部请求之间**的竞争，并不能阻止真实用户或其他进程改变界面。因此系统仍然需要 epoch、前台检查、后置观察，以及保守的 `unknown` 结果作为兜底。

---

## 6. macOS 与 Windows 的实现差异

维度macOSWindowsHelper 语言SwiftRustUI 语义Accessibility API（AX）Microsoft UI Automation（UIA）截图ScreenCaptureKit；失败后 `screencapture`GDI `PrintWindow`；黑图/失败时 `BitBlt`截图编码JPEGPNG物理输入CGEvent`SendInput`进程通信Unix Domain Socket + JSON Lines子进程 stdin/stdout + JSON Lines v3OCRVision，可按需执行当前未实现 OCR根变化加速AXObserver + CGWindowList，前后快照为准`SetWinEventHook` 事件日志，前后快照为准

Microsoft 将 UI Automation 定义为桌面 UI 的可访问性框架，可供辅助技术和自动化测试读取并操控大多数 UI 元素。[Microsoft UI Automation](https://learn.microsoft.com/en-us/windows/win32/winauto/entry-uiauto-win32)

Windows 的物理输入通过 `SendInput` 将键盘和鼠标事件插入输入流。官方文档特别指出它受 UIPI 完整性级别限制，因此普通权限的进程无法可靠操控更高完整性级别的窗口。[Microsoft SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)

Windows 截图优先使用 GDI `PrintWindow`；当 GPU 表面返回黑图或捕获失败时，再回退到屏幕 `BitBlt`。[Windows 捕获实现](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/windows/bridge-rs/src/capture.rs#L220-L303)

### 6.1 macOS Helper 的线程模型

macOS app 的主线程运行 AppKit；Unix socket server 在独立线程接受连接，每个客户端连接再交由独立线程处理。AXObserver 也各自拥有独立的 RunLoop 线程，以避免与 AppKit 渲染竞争。当前 root observer 缓存最多覆盖 4 个 PID，并按最近使用情况淘汰。[socket server](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/macos/bridge.swift#L394-L471) · [AXObserver 管理](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/macos/bridge.swift#L1642-L1701)

### 6.2 Root delta 的证据边界

AXObserver / WinEventHook 用于尽早发现潜在变化，而前后 root 快照则负责确认持久状态。以 macOS 为例，sheet 出现时可能并没有 AX 通知，因此实现始终保留快照比较作为最终依据。[macOS root delta](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/macos/bridge.swift#L2208-L2241)

这是一项重要设计原则：**事件是提示，状态快照才是持久变化的权威证据。**

---

## 7. 与 Anthropic、OpenAI Computer Use 的对比

pi-computer-use 与模型厂商的 Computer Use 工具处在不同的系统层级：前者提供本机执行 harness，后两者主要定义模型侧的观察—动作协议。因此，更适合从集成边界与责任划分的角度来对比。

维度pi-computer-useAnthropic Computer UseOpenAI Computer Use产品层级可直接连接本机桌面的 Pi 扩展与执行运行时模型工具协议；宿主实现执行环境和 agent loop内置 `computer` 工具，也支持自定义 harness 与代码执行路径默认观察AX/UIA + 可选图像；macOS 可选 OCR；浏览器可走 CDP截图为核心输入内置路径以截图为核心，也允许自定义视觉/程序化混合 harness默认定位状态内 `@e` ref；必要时坐标模型返回坐标动作模型返回结构化 UI 动作，内置路径主要由宿主按坐标执行状态与并发项目内建 `stateId`、epoch、按资源 lane由消息历史和宿主应用设计由 Responses 调用链与宿主 harness 设计执行责任本项目直接实现 macOS / Windows 后端应用必须实现截图、鼠标和键盘动作应用执行 actions 并回传新截图，或提供自定义 harness

Anthropic 官方文档明确说明，Claude 不会直接连接执行环境；应用负责接收工具请求、执行动作、捕获截图，再把结果返回给模型。[Anthropic Computer Use](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use-tool)

OpenAI 当前官方文档基于 Responses API 的 `computer` 工具，并同时提供三种集成路径：内置 Computer Use 循环、自定义工具/harness、代码执行 harness。内置循环要求宿主顺序执行 `actions[]`，再回传更新后的截图。[OpenAI Computer Use](https://platform.openai.com/docs/guides/tools-computer-use)

在这种分层之下，状态管理和批处理能力需要结合宿主实现来看待：Anthropic 和 OpenAI 将部分状态责任交给消息循环与执行环境，而 OpenAI 的一次 `computer_call` 也可以包含多个有序 action。pi-computer-use 则把 `stateId`、epoch 和资源 lane 直接实现进本机运行时。

结构化 ref 能消除一部分坐标定位的不确定性，纯视觉路径则对缺乏可访问性信息的界面更为通用。两者的准确率仍取决于模型、任务、应用和运行环境，需要通过同条件基准测试来评估。整体而言，**pi-computer-use 提供的是结构化、状态化的本机执行 harness，模型厂商工具提供的是模型侧的观察—动作协议——两者既可独立使用，也可组合。**

---

## 8. 关键设计边界

### 8.1 `@e` ref 的生命周期

ref 的优势在于它保留了角色、标题、能力和元素身份，而不完全依赖屏幕像素。即便窗口移动，Helper 也可能凭借保存的特征重新查找到元素。

但 ref 仍受三个边界约束：

1. 它属于某个不可变的 `stateId`；
2. 对应的状态或 native look 可能被淘汰；
3. UI 重建后可能无法唯一 refind，此时系统返回 `stale_ref`。

因此，ref 更宜被理解为**某次观察内的语义定位证据**：系统会尝试重定位，一旦缺少可靠匹配则返回 `stale_ref`。

### 8.2 `headless` 的执行语义

项目中的 `headless: true` 表示一种严格的后台执行策略：禁止激活或抬升应用、改变用户焦点、移动全局光标、发送原始输入以及显示 agent cursor。至于虚拟显示器和无桌面会话环境，则不在这个配置项的职责范围之内。[headless 配置说明](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/docs/configuration.md#headless)

### 8.3 内部 Input Suppression 能力

macOS Helper 实现了 `beginInputSuppression` / `endInputSuppression`，并配有 30 秒 watchdog，用于防止异常情况下长时间屏蔽用户输入。该能力目前仅保留在原生协议内部，尚未暴露为公开工具，`act_ui` 的多动作路径也不会自动启用它。[InputSuppression 实现](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/macos/bridge.swift#L231-L338)

### 8.4 Agent cursor 可视化层

macOS 的橙色 cursor overlay 使用 Dubins 路径和弹簧阻尼动画，但它本质上是一个 click-through 的视觉反馈层：既不接收输入，也不阻塞动作投递。配置文档还明确指出，它并不会移动系统指针。[cursor 配置](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/docs/configuration.md#cursor_overlay) · [路径实现](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/macos/agent_cursor_motion.swift#L20-L99)

Dubins 求解器会在 LSL、RSR、LSR、RSL、RLR、LRL 六类候选中选出最短可行路径，求解失败时退化为线性插值。[Dubins 求解](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/native/macos/agent_cursor_motion.swift#L204-L240)

---

## 9. 局限、安全边界与适用场景

### 9.1 已知局限

1. **语义树覆盖不完整**：游戏、Canvas、自绘控件和部分 Web UI 可能只有图像，而没有可靠的 AX/UIA 节点。
2. **平台能力不完全对称**：OCR 目前只在 macOS 实现；Windows 的截图和输入也受窗口合成、UIPI 与桌面会话的限制。
3. **ref 会过期**：128 个 Agent 状态和 8 个 native look 都是有界缓存，旧状态需要重新观察。
4. **验证不等于业务证明**：值变化、窗口变化或后置文本出现，仍不一定等同于远端业务成功；关键任务应检查更强的业务信号。
5. **并发不能消除外部竞争**：lane 和物理输入锁只协调本项目内部的调用，无法锁住真实用户和其他自动化程序。
6. **前台操作会影响用户**：非 headless 模式可能激活应用、改变焦点并发送全局输入。
7. **性能取决于目标应用**：AX/UIA 树的质量、窗口尺寸、OCR 和截图路径都会影响延迟，应以工具返回的 timings 和端到端任务数据来建立基线。

### 9.2 安全边界

Computer Use 会接触屏幕、键盘、文件和登录态，其风险远高于普通的文本问答。至少应遵循以下原则：

- 优先在受控账户、虚拟机或隔离环境中执行；
- 对发送消息、付款、删除、授权等高影响动作保留人工确认；
- 把网页、邮件、PDF 和屏幕文字都视为不可信输入，防范 prompt injection；
- 不把“模型决定点击”直接等同于“用户授权执行”；
- 保存操作日志、后置条件和关键截图，以便审计；
- 对已提供 API、数据库事务或 MCP 的流程，优先使用结构化接口。

Anthropic 与 OpenAI 的官方 Computer Use 文档同样强调隔离环境、敏感操作人工确认，以及将页面内容视为不可信输入。这些措施共同构成了 Computer Use 系统的基础安全要求。[Anthropic 文档](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use-tool) · [OpenAI 文档](https://platform.openai.com/docs/guides/tools-computer-use)

### 9.3 最适合与不适合的场景

适合不适合没有 API 的桌面软件已有稳定 API / MCP 的系统低频、可观察、可回退的流程高频、低延迟、大吞吐任务软件测试和跨应用操作要求严格事务回滚的关键业务可设置明确后置条件的任务无法验证结果且副作用很高的任务受控环境中的人机协作无监督操作敏感账户或生产数据

---

## 10. 总结

pi-computer-use 的核心价值，在于为 Agent 的 UI 操作建立了一套明确的执行契约：

- 用 root、`stateId` 和 state-scoped ref，明确“动作依据的是哪一次观察”；
- 用按资源划分的 lane 和 epoch，拒绝陈旧的并发写入；
- 用 Progressive Disclosure 控制模型上下文，同时不丢失完整状态；
- 用语义 API、坐标输入和平台策略，完成分层的 grounding；
- 用 `worked` / `didnt` / `unknown`、后置条件和 successor observation，区分“投递”与“结果”；
- 用平台不变量统一 macOS 与 Windows，而不强求底层源码同构。

AX/UIA 覆盖、视觉理解、外部竞争、权限、prompt injection 和业务级验证，仍是这类系统需要持续应对的边界。但 pi-computer-use 展示了一条值得复用的工程路线：**让 Agent 的每一个 UI 动作，都带着来源状态、执行策略和可审计的证据。**

---

## 11. 专业术语表

本表汇总全文出现的关键术语，便于查阅。按主题分组，术语首次在正文出现时保留原文写法。

### 状态与并发模型

术语含义**Root（**`@rN`）一个可观察的顶层对象，如桌面窗口、菜单、对话框或浏览器页面。所有观察都以某个 root 为起点。`stateId`一次观察生成的、不可变的状态标识。它是一次“快照”的凭证，后续所有搜索、检查、操作都必须显式携带它。**元素 ref（**`@eN`）指向某个 UI 元素的引用，只在产生它的那个 `stateId` 内有效。保留角色、标题、能力等语义特征，而非仅屏幕像素坐标。**多根森林（multi-root forest**）把桌面窗口与浏览器页面等异构 root 统一建模为并列的多棵树，从而复用同一套观察与状态接口。**epoch**每个资源上单调递增的版本号。写操作前比对 epoch，用于拒绝基于陈旧状态的并发写入。**乐观并发控制（Optimistic Concurrency Control**）一种并发策略：先假设无冲突地执行，提交时再用版本号校验；此处即通过 epoch 实现。**资源 lane**按物理资源（如某个进程 PID、某个浏览器 target）划分的串行执行通道，同一 lane 内动作顺序执行、跨 lane 可并行。`StaleResourceStateError`当状态携带的 epoch 与资源当前 epoch 不一致时抛出的错误，表示写入基于了已过期的状态。**有界缓存（bounded cache**）容量固定、按顺序淘汰的缓存。此处指 128 条状态存储与 8 条 native look 存储。`stale_ref` **/** `stale_look`分别表示元素引用、look 记录因状态淘汰或 UI 重建而失效，需重新观察。

### 观察与可访问性

术语含义**Accessibility / 可访问性树**操作系统为辅助技术暴露的 UI 结构树，包含角色、标题、位置和可执行动作。macOS 为 AX，Windows 为 UIA。**AX（Accessibility API**）Apple 的可访问性接口，核心类型为 `AXUIElement`，提供元素层级、位置、角色与动作。**UIA（UI Automation**）微软的桌面可访问性框架，供辅助技术和自动化测试读取并操控 UI 元素。`AXUIElement`AX 中指向单个可访问对象的结构，是遍历 macOS UI 树的基本单元。**OCR（Optical Character Recognition**）光学字符识别，从图像中提取文字。macOS 通过 Vision 框架实现，Windows 当前未实现。`pictureOnly` **节点**OCR 识别到、但无法归属到任何 AX 元素的文字，仅可用于坐标定位。**Progressive Disclosure（渐进式披露**）内部保存完整树，默认只返回折叠概要，按需再展开或检查局部，用以控制模型上下文成本。`window-relative-screenshot-pixels`坐标系约定：以“相对窗口的截图像素”为基准，坐标动作必须使用产生该图像的那次状态。`captureMs` **/** `describeMs` **/** `readTextMs`观察返回的耗时指标，分别对应截图、描述树、OCR 阶段，用于建立性能基线。

### 操作与验证

术语含义**grounding**目标如何定位——通过 ref、坐标还是其他语义特征找到要操作的元素。**delivery**输入如何投递——走语义 API（如 `AXPress`），还是物理输入（如 CGEvent / SendInput）。**verification**结果如何确认——通过读回值、后置条件或重新观察来判断动作是否生效。`worked` **/** `didnt` **/** `unknown`动作结果的三类证据强度：有成功证据 / 有失败证据 / 证据不足以断言。描述证据强度，而非业务真相。`act_ui.expect`**（后置条件**）动作后要求某段文本、角色或精确值出现或消失；超时则将结果降级为失败并返回 `postcondition_failed`。**后台优先（background-first**）优先使用不打扰用户的语义路径，仅在其失败时才升级为前台激活与物理输入。**前台 fallback**语义路径失败后升级到的前台执行：可能激活应用、改变焦点、发送全局输入。`headless`严格后台执行策略：禁止激活/抬升应用、改变焦点、移动全局光标、发送原始输入及显示 agent cursor。`actBatch` **/ batch**一次下沉到 Native Helper 的多动作批处理，顺序执行、失败即停，无事务回滚。`stoppedAt`多动作批处理中断时的位置标记，用于说明执行到哪一步失败。**Input Suppression**原生能力，可临时屏蔽用户输入，配 30 秒 watchdog 兜底；目前未暴露为公开工具。**物理输入锁**保证目标聚焦、遮挡检查和输入投递不被另一物理动作插入的锁（macOS 用 `NSRecursiveLock`）。

### 平台与集成

术语含义**Pi 扩展**pi-computer-use 的产品形态：连接 Agent 工具与桌面执行环境的扩展。**Native Helper**承载操作系统相关逻辑的原生进程（macOS 为 Swift，Windows 为 Rust），隔离权限、线程模型与物理输入。**harness**承载“观察—动作”循环的执行框架。pi-computer-use 提供本机执行 harness，模型厂商工具则提供模型侧协议。**CDP（Chrome DevTools Protocol**）Chrome 的调试协议，用于接入并控制浏览器页面，将其建模为 `browser_page` root。**JSON Lines**每行一条 JSON 记录的流式格式，用于 TypeScript 与 Native Helper 之间的通信。**TCC（Transparency, Consent, and Control**）macOS 的隐私授权机制，要求 Helper 绑定到稳定的应用身份。**CGEvent**macOS 底层事件接口，用于合成键盘和鼠标的物理输入。`SendInput`Windows 的输入注入 API，受 UIPI 完整性级别限制。**UIPI（User Interface Privilege Isolation**）Windows 的界面权限隔离机制，普通权限进程无法可靠操控更高完整性级别的窗口。**ScreenCaptureKit /** `SCScreenshotManager`macOS 14+ 的窗口捕获接口，用于单帧截图。**GDI** `PrintWindow` **/** `BitBlt`Windows 的截图接口，前者优先，返回黑图或失败时回退到后者。**AXObserver /** `SetWinEventHook`分别为 macOS 与 Windows 的 UI 事件监听机制，用于尽早发现潜在变化。**root delta / 快照比较**通过前后 root 快照对比确认持久状态变化——事件只是提示，快照才是权威证据。**Dubins 路径**一种在最小转弯半径约束下连接两点的最短曲线，用于 agent cursor 的动画轨迹。**MCP（Model Context Protocol**）模型上下文协议，一种结构化的工具/数据集成方式；文档建议对已具备 MCP 的流程优先使用它。**prompt injection（提示词注入**）攻击者在页面、邮件等内容中植入指令以劫持模型行为；应把这类内容一律视为不可信输入。

hello world

---

## 参考资料

### 项目源码与文档

- [pi-computer-use README（v0.4.3 对应提交）](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/README.md)
- [Architecture](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/docs/architecture.md)
- [Usage](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/docs/usage.md)
- [Configuration](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/docs/configuration.md)
- [Windows Bridge](https://github.com/injaneity/pi-computer-use/blob/6afb88f42942a0fb0e753fb7eb085b7529147ee8/docs/windows-bridge.md)

### 平台官方资料

- [Apple: AXUIElement](https://developer.apple.com/documentation/applicationservices/axuielement)
- [Apple: SCScreenshotManager](https://developer.apple.com/documentation/screencapturekit/scscreenshotmanager)
- [Microsoft: UI Automation](https://learn.microsoft.com/en-us/windows/win32/winauto/entry-uiauto-win32)
- [Microsoft: SendInput](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput)

### 模型厂商 Computer Use 文档

- [Anthropic: Computer use tool](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/computer-use-tool)

[OpenAI: Computer use](https://platform.openai.com/docs/guides/tools-computer-use)
