# Writer 体验优化小功能实施计划

> **给实现者：**按功能编号逐个实现。每个功能都要独立完成：代码、测试、基础视觉检查、提交说明。

**目标：**把 Writer 打磨成一个 macOS 风格清晰、编辑体验专注、保存状态明确、Markdown/MDX 能力可扩展的写作工具。

**架构方向：**保留 MDXEditor 作为编辑器内核，在外层增加 Writer 自己的体验层。体验层负责工作台状态、命令展示、检查器组织、选区操作、预览模式和保存状态表达。

**技术栈：**Tauri 2、React 19、TypeScript、Vite、`@mdxeditor/editor@4.0.4`、lucide-react、现有 `src/styles/app.css` reader token 体系。

---

## 使用方式

- 按 F01、F02、F03 的顺序逐个实现。
- 每个功能保持独立可验收。
- 每个功能完成后运行对应测试。
- 每 2-3 个功能运行一次全量验证。
- 样式继续以 `src/styles/app.css` 为主入口。
- Light mode 继续对齐 Madinah blog 的 warm reader palette。
- AI Polish 继续放在编辑器右键菜单里。

## 当前能力盘点

### 已有产品能力

- 文件工作流：多根目录文件树、app 内草稿、最近文件、打开文件、保存、另存为、重命名、复制、移动到 app trash。
- 写作工作流：live-rendered MDXEditor、Markdown shortcuts、Focus Mode、Typewriter Mode、Command Palette、Quick Open、文内搜索、Outline。
- 内容模型：Markdown 文档元数据、frontmatter 解析和序列化、`commonmark`、`gfm`、`mdx`、`blog-mdx` profiles。
- 扩展模型：workspace 识别、可信 workspace plugins、profile merge、命令注册、plugin diagnostics。
- AI 工作流：ACP 设置、本地 agent 检查、`ai.polish.document`、编辑器右键菜单入口。

### 当前 MDXEditor 可用能力

- 已用方法：`getMarkdown`、`setMarkdown`、`insertMarkdown`、`focus`、`getSelectionMarkdown`、`getContentEditableHTML`。
- 已用插件：headings、lists、quote、thematic break、link、link dialog、image、code block、CodeMirror code editing、table、JSX、Markdown shortcuts。
- 可接入插件：`toolbarPlugin`、`diffSourcePlugin`、`frontmatterPlugin`、`directivesPlugin`、`searchPlugin`、`maxLengthPlugin`。
- 可接入 toolbar primitive：`UndoRedo`、`BoldItalicUnderlineToggles`、`CodeToggle`、`CreateLink`、`InsertTable`、`ListsToggle`、`BlockTypeSelect`、`DiffSourceToggleWrapper`。

## 实施顺序

1. P0：保存状态和工作台状态清晰化。
2. P0：检查器 tabs 和写作统计优化。
3. P1：预览模式和命令面板元数据。
4. P1：选区工具条和编辑器操作体验。
5. P2：源码/frontmatter 模式、搜索增强、文件树状态标记。
6. P2：插件诊断、空状态、键盘和无障碍体验。

## 小功能列表

### F01 - 明确保存状态展示

**优先级：**P0

**目标：**标题栏用颜色和图标准确表达当前编辑内容处于哪个状态：正在编辑、已写入 recovery draft、已保存到 app 内文档、已保存到原始文件。

**用户价值：**用户能判断 `Draft saved` 和 `Saved to file` 的差异，减少真实文件保存误判。

**实现边界：**
- 新增 `SavePresentation` 辅助类型和状态映射函数。
- 输入为 `DocumentSession`、当前 `status`。
- 输出为标题栏展示 icon、tone、label、tooltip、语义状态。
- 标题栏可见 UI 使用图标和颜色；`label` 进入 `title`、`aria-label` 和测试断言。
- 文件模式下 `draftStatus === "saved"` 表示 recovery draft 已写入，原始文件仍等待手动保存。
- app 内文档保存完成后仍显示 app 内保存语义，文件模式手动保存完成后显示原始文件保存语义。

**状态表：**

| 语义状态 | 条件 | 图标 | 颜色 | Tooltip / aria |
| --- | --- | --- | --- | --- |
| `edited` | `isDirty === true` 且 `draftStatus === "idle"` | `PencilLine` | amber | `Edited` |
| `draft-saved` | `filePath` 存在，`isDirty === true`，`draftStatus === "saved"` | `FileClock` | gold / amber | `Recovery draft saved` |
| `file-saved` | `filePath` 存在，`isDirty === false` | `FileCheck2` | green | `Saved to file` |
| `app-saved` | `filePath` 为空，`isDirty === false` | `CheckCircle2` | muted green | `Saved` |
| `saving` | `draftStatus === "saving"` 或当前 `status === "Saving"` | `LoaderCircle` | blue | `Saving` |
| `error` | `draftStatus === "error"` 或 `session.error` 有值 | `CircleAlert` | red | `Save failed: ...` |
| `opening` | 当前 `status === "Opening"` | `LoaderCircle` | muted blue | `Opening` |
| `creating` | 当前 `status === "Creating"` | `LoaderCircle` | muted blue | `Creating` |

**建议类型：**

```ts
export type SaveSemanticState =
  | "edited"
  | "draft-saved"
  | "file-saved"
  | "app-saved"
  | "saving"
  | "opening"
  | "creating"
  | "error";

export type SavePresentationIcon =
  | "pencil"
  | "file-clock"
  | "file-check"
  | "check"
  | "loader"
  | "alert";

export interface SavePresentation {
  state: SaveSemanticState;
  label: string;
  tooltip: string;
  icon: SavePresentationIcon;
  tone: "edited" | "draft" | "saved" | "busy" | "error";
  isBusy: boolean;
}
```

**涉及文件：**
- 新建：`src/features/workbench/workbench-state.ts`
- 新建测试：`src/features/workbench/workbench-state.test.ts`
- 修改：`src/App.tsx`
- 修改：`src/styles/app.css`

**验收标准：**
- 文件模式 dirty 状态显示 `PencilLine` + amber，tooltip 为 `Edited`。
- 文件模式 recovery draft 写入后显示 `FileClock` + gold / amber，tooltip 为 `Recovery draft saved`。
- 手动 `Cmd+S` 写回原文件后显示 `FileCheck2` + green，tooltip 为 `Saved to file`。
- app 内文档保存后显示 `CheckCircle2` + muted green，tooltip 为 `Saved`。
- 保存失败显示 `CircleAlert` + red，tooltip 包含失败信息。
- 移动端标题栏保留保存状态图标。
- 可见标题栏避免 `Edited`、`Draft saved`、`Saved to file` 这类状态文字常驻展示。

**验证方式：**
- 运行 `./node_modules/.bin/vitest run src/features/workbench/workbench-state.test.ts`
- 打开 workspace 文件，输入内容，等待 draft 保存，按 `Cmd+S`，观察标题栏图标和颜色变化。
- 用鼠标悬停状态图标，确认 tooltip 与状态表一致。

---

### F02 - 抽离工作台状态

**优先级：**P0

**目标：**把视图模式、检查器状态、Focus Mode、Typewriter Mode、相关命令注册从 `App.tsx` 中抽离。

**用户价值：**后续功能修改范围更小，交互状态更容易维护。

**实现边界：**
- 定义 `WriterViewMode = "write" | "preview"`。
- 定义 `InspectorTab = "outline" | "properties" | "stats" | "history"`。
- view mode 和 inspector tab 通过 localStorage 持久化。
- 现有快捷键保持稳定。

**涉及文件：**
- 新建：`src/features/workbench/workbench-state.ts`
- 新建：`src/features/workbench/workbench-commands.ts`
- 新建测试：`src/features/workbench/workbench-commands.test.ts`
- 修改：`src/App.tsx`

**验收标准：**
- 现有 View 命令继续工作。
- 现有命令 id 保持稳定。
- 新增 `view.write`、`view.preview`、`inspector.showOutline`、`inspector.showProperties`、`inspector.showStats`、`inspector.showHistory`。
- `App.tsx` 中工作台状态分支明显减少。

**验证方式：**
- 运行 `./node_modules/.bin/vitest run src/features/workbench/workbench-commands.test.ts src/features/commands/native-menu.test.ts`
- 用 Command Palette 切换 Write 和 Preview。

---

### F03 - 右侧检查器改成 Tabs

**优先级：**P0

**目标：**右侧栏默认服务写作结构，元数据、统计、历史进入明确 tab。

**用户价值：**写作时默认看到 Outline，元数据表单降低干扰。

**实现边界：**
- 抽出 `DocumentInspector.tsx`。
- 增加 `Outline`、`Properties`、`Stats`、`History` 四个 tab。
- 默认 tab 为 `Outline`。
- 保留现有元数据编辑和版本历史能力。

**涉及文件：**
- 新建：`src/features/inspector/DocumentInspector.tsx`
- 新建：`src/features/inspector/InspectorTabs.tsx`
- 修改：`src/App.tsx`
- 修改：`src/styles/app.css`

**验收标准：**
- 右侧栏默认显示 Outline。
- Properties tab 可以编辑 title、description、tags、status、author、publish date。
- History tab 可以 save version 和 restore version。
- tab 在 308px 检查器宽度内完整显示。

**验证方式：**
- 运行 `./node_modules/.bin/tsc --noEmit`
- 截图检查 1440x960 dark/light 两种主题。

---

### F04 - 写作统计紧凑化

**优先级：**P0

**目标：**把写作统计改成稳定可读的行式布局。

**用户价值：**`Characters` 等标签完整显示，数值更容易扫描。

**实现边界：**
- 用一列行式布局替代当前 card grid。
- 保留当前指标：words、characters、blocks、headings、links、images、read minutes。
- 数值使用 tabular numbers。

**涉及文件：**
- 新建：`src/features/inspector/WritingStats.tsx`
- 新建测试：`src/features/inspector/writing-stats.test.ts`
- 修改：`src/styles/app.css`

**验收标准：**
- `Characters` 标签完整显示。
- 数值右对齐。
- dark/light 都可读。
- 900x700 下无截断。

**验证方式：**
- 运行 `./node_modules/.bin/vitest run src/features/inspector/writing-stats.test.ts`
- 在 Stats tab 检查 1440x960 和 900x700。

---

### F05 - Write / Preview 视图模式

**优先级：**P1

**目标：**把已有 `PreviewPane` 接入主工作台。

**用户价值：**用户可以在 live editing 和最终 blog-style rendering 之间切换。

**实现边界：**
- 标题栏增加 Write/Preview 控制，使用 segmented control 或图标按钮组。
- Write 模式渲染 `MarkdownEditor`。
- Preview 模式渲染已有 `PreviewPane`。
- Preview 继续使用 `reader-*` tokens 和 Jinkai 字体。

**涉及文件：**
- 修改：`src/App.tsx`
- 修改：`src/features/preview/PreviewPane.tsx`
- 修改：`src/styles/app.css`
- 修改测试：`src/features/preview/PreviewPane.test.tsx`

**验收标准：**
- Preview 模式渲染当前文档 body。
- MDX profile components 通过 `mdxComponents` 渲染。
- Preview 编译错误显示在画布内。
- 切回 Write 模式后编辑器恢复 focus。

**验证方式：**
- 运行 `./node_modules/.bin/vitest run src/features/preview/PreviewPane.test.tsx src/lib/mdx-preview.test.tsx`
- 从标题栏和 Command Palette 切换 Write/Preview。

---

### F06 - 命令元数据和分组展示

**优先级：**P1

**目标：**让 Command Palette 成为真正可发现的控制中心。

**用户价值：**用户可以按 File、Edit、View、Insert、AI 快速找到命令，并看到快捷键。

**实现边界：**
- `WriterCommand` 增加可选字段：`shortcut`、`scope`、`priority`。
- 保持现有 command id 稳定。
- Command Palette 按 group 分组展示。
- 快捷键展示在结果右侧。

**涉及文件：**
- 修改：`src/domain/engine.ts`
- 修改：`src/features/commands/command-palette.tsx`
- 修改测试：`src/features/commands/command-palette.test.ts`

**验收标准：**
- 空查询时高优先级命令靠前。
- 搜索继续匹配 label、group、id、keywords。
- Save、Quick Open、Command Palette、Find、Bold、Italic、Link 展示快捷键。

**验证方式：**
- 运行 `./node_modules/.bin/vitest run src/features/commands/command-palette.test.ts`
- 打开 Command Palette 检查分组和快捷键。

---

### F07 - macOS 菜单补齐新视图命令

**优先级：**P1

**目标：**让 macOS 菜单栏、快捷键、Command Palette 的视图命令保持一致。

**用户价值：**用户从菜单栏也能切换视图和检查器 tab。

**实现边界：**
- 增加 Write Mode、Preview Mode 菜单项。
- 增加 Inspector tab 菜单项。
- 复用 `workbench-commands.ts` 中的 command id。

**涉及文件：**
- 修改：`src-tauri/src/menu.rs`
- 修改测试：`src-tauri/src/menu.rs`
- 修改测试：`src/features/commands/native-menu.test.ts`

**验收标准：**
- Rust 菜单 item id 映射到 frontend command id。
- frontend native-menu extractor 能识别新增命令。
- 原有菜单测试继续通过。

**验证方式：**
- 运行 `cargo test --manifest-path src-tauri/Cargo.toml menu`
- 运行 `./node_modules/.bin/vitest run src/features/commands/native-menu.test.ts`

---

### F08 - 编辑器浮动选区工具条

**优先级：**P1

**目标：**文本选中后在选区附近显示常用格式化动作。

**用户价值：**Bold、Italic、Link、Inline Code 的操作路径更短。

**实现边界：**
- 新增 `EditorSelectionToolbar.tsx`。
- 只在 `.live-mdx-shell` 内存在非空选区时显示。
- 动作包含 Bold、Italic、Link、Inline Code。
- AI Polish 继续保留在右键菜单。

**涉及文件：**
- 新建：`src/features/editor/EditorSelectionToolbar.tsx`
- 修改：`src/features/editor/MarkdownEditor.tsx`
- 修改：`src/styles/app.css`
- 新建测试：`src/features/editor/editor-selection-toolbar.test.ts`

**验收标准：**
- 选中文本后工具条出现。
- 空选区时工具条隐藏。
- 工具条保持在 viewport 内。
- 点击动作后执行对应 command，并回到编辑器 focus。
- Escape 隐藏工具条。

**验证方式：**
- 运行 `./node_modules/.bin/vitest run src/features/editor/editor-selection-toolbar.test.ts src/features/editor/formatting-commands.test.ts`
- 在段落中选中文本，执行 Bold、Italic、Inline Code。

---

### F09 - 编辑器右键菜单分组

**优先级：**P1

**目标：**让右键菜单的 AI 和格式化动作更清晰。

**用户价值：**右键菜单稳定、可读、状态明确。

**实现边界：**
- 支持 menu separator。
- 选区为空时禁用依赖选区的动作。
- 菜单宽度稳定为 200px。

**涉及文件：**
- 修改：`src/features/editor/editor-context-menu.ts`
- 修改：`src/features/editor/MarkdownEditor.tsx`
- 修改：`src/styles/app.css`
- 修改测试：`src/features/editor/editor-context-menu.test.ts`

**验收标准：**
- 菜单保持在 viewport 内。
- disabled item 使用 muted 样式。
- disabled item 点击后跳过执行。
- AI Polish 始终保留在菜单中。

**验证方式：**
- 运行 `./node_modules/.bin/vitest run src/features/editor/editor-context-menu.test.ts`
- 分别右键选中文本和空白编辑区域。

---

### F10 - Command Palette 插入块能力整理

**优先级：**P1

**目标：**把插入块能力集中到 profile-aware 的 Command Palette 中。

**用户价值：**用户可以搜索插入 headings、lists、tables、code blocks、images、footnotes、frontmatter、callouts。

**实现边界：**
- 复用 `builtinProfiles.tsx` 中已有 insert commands。
- 为插入命令补充 group、keywords、priority。
- Command Palette 增强 `Insert` 分组展示。

**涉及文件：**
- 修改：`src/features/engine/builtinProfiles.tsx`
- 修改：`src/features/commands/command-palette.tsx`
- 修改测试：`src/features/engine/builtinProfiles.test.ts`
- 修改测试：`src/features/commands/command-palette.test.ts`

**验收标准：**
- CommonMark 显示基础 Markdown 插入命令。
- GFM 显示 table、checklist、footnote。
- MDX 显示 callout。
- Blog MDX 显示 frontmatter。

**验证方式：**
- 运行 `./node_modules/.bin/vitest run src/features/engine/builtinProfiles.test.ts src/features/commands/command-palette.test.ts`
- 切换 profile 后检查 Command Palette 的 Insert 分组。

---

### F11 - Markdown Source Mode

**优先级：**P2

**目标：**提供源码 Markdown 检查和编辑模式。

**用户价值：**高级用户可以排查 Markdown、frontmatter、MDX 语法问题。

**实现边界：**
- 接入 MDXEditor `diffSourcePlugin`。
- 增加 `view.source` command。
- Write 模式保持 rich text 默认体验。
- Source Mode 作为 Write 里的编辑子模式。

**涉及文件：**
- 修改：`src/features/engine/builtinProfiles.tsx`
- 修改：`src/features/workbench/workbench-commands.ts`
- 修改：`src/features/editor/MarkdownEditor.tsx`
- 修改测试：`src/features/engine/builtinProfiles.test.ts`

**验收标准：**
- Source Mode 打开后展示当前 Markdown。
- 切回 rich text 后内容一致。
- profile plugins 继续加载。

**验证方式：**
- 运行 `./node_modules/.bin/vitest run src/features/engine/builtinProfiles.test.ts`
- 在包含 heading、table、code block 的文档中切换 Source Mode。

---

### F12 - 文内搜索跳转增强

**优先级：**P2

**目标：**让搜索跳转定位到真实匹配位置。

**用户价值：**Find next / previous 在编辑器内表现更可靠。

**实现边界：**
- 保留现有 `findDocumentMatches` 纯函数。
- 增加 editor DOM 定位逻辑。
- 可行时给 active match 添加视觉状态。

**涉及文件：**
- 修改：`src/features/search/in-document-search.ts`
- 修改测试：`src/features/search/in-document-search.test.ts`
- 修改：`src/App.tsx`
- 修改：`src/styles/app.css`

**验收标准：**
- Enter 跳到下一处匹配。
- Shift+Enter 跳到上一处匹配。
- 0、1、多匹配计数正确。
- active match 滚动到接近画布中心。

**验证方式：**
- 运行 `./node_modules/.bin/vitest run src/features/search/in-document-search.test.ts`
- 在长文档中搜索重复词并连续跳转。

---

### F13 - 文件树编辑状态标记

**优先级：**P2

**目标：**文件树展示当前文件的 edited 和 draft saved 状态。

**用户价值：**用户在侧边栏就能看到当前文件状态。

**实现边界：**
- active file row 根据 `session.filePath` 和 `session.isDirty` 显示 edited dot。
- active file row 在 `draftStatus === "saved"` 后显示 draft marker。
- 文件树数据结构保持稳定。

**涉及文件：**
- 修改：`src/features/file-tree/FileTreeSidebar.tsx`
- 修改：`src/features/file-tree/file-tree.ts`
- 修改测试：`src/features/file-tree/file-tree.test.ts`
- 修改：`src/styles/app.css`

**验收标准：**
- 当前文件 dirty 时显示 edited dot。
- recovery draft 写入后显示 draft marker。
- app 内 draft rows 保留现有状态标签。

**验证方式：**
- 运行 `./node_modules/.bin/vitest run src/features/file-tree/file-tree.test.ts`
- 打开 workspace 文件，输入内容，等待 draft 保存，检查 active row。

---

### F14 - Workspace Plugin Diagnostics 展示

**优先级：**P2

**目标：**把 workspace plugin 加载诊断展示到 UI。

**用户价值：**workspace 扩展问题可以被用户看见并定位。

**实现边界：**
- 新增 plugin diagnostics 组件。
- 展示 plugin id、severity、message。
- 增加 `workspace.showDiagnostics` command。

**涉及文件：**
- 新建：`src/features/engine/PluginDiagnostics.tsx`
- 修改：`src/features/engine/EngineProvider.tsx`
- 修改：`src/features/inspector/DocumentInspector.tsx`
- 修改测试：`src/features/engine/ExtensionHost.test.ts`

**验收标准：**
- plugin activation error 后显示 diagnostics。
- 健康状态展示 workspace extensions healthy。
- error 使用现有错误色。

**验证方式：**
- 运行 `./node_modules/.bin/vitest run src/features/engine/ExtensionHost.test.ts`
- 使用已有测试 fixture 或临时 bad plugin workspace 验证 UI。

---

### F15 - 空状态、加载态、错误态优化

**优先级：**P2

**目标：**每个主要区域在空内容、加载中、错误时都有明确反馈。

**用户价值：**首次打开、目录为空、编译失败、搜索为空时体验更完整。

**实现边界：**
- 文件树：添加打开文件夹入口。
- 编辑区：空文档 placeholder。
- Preview：编译中和编译失败状态。
- Inspector：tab 级空状态。
- Command Palette：无结果状态展示当前 query。

**涉及文件：**
- 修改：`src/App.tsx`
- 修改：`src/features/file-tree/FileTreeSidebar.tsx`
- 修改：`src/features/commands/command-palette.tsx`
- 修改：`src/features/preview/PreviewPane.tsx`
- 修改：`src/styles/app.css`

**验收标准：**
- 首次打开可选择 Open Folder 和 New Document。
- Command Palette 无结果时展示当前 query。
- Preview 编译失败保留当前文档内容。

**验证方式：**
- 运行 `./node_modules/.bin/tsc --noEmit`
- 分别检查 browser mode 和 Tauri mode 的首次打开体验。

---

### F16 - 键盘和无障碍体验补齐

**优先级：**P2

**目标：**核心工作流可通过键盘稳定完成。

**用户价值：**高频写作用户可以持续停留在编辑器中操作。

**实现边界：**
- 检查 dialogs、Command Palette、Quick Open、Search、context menu 关闭后的 focus 返回。
- tabs 和 segmented controls 增加 `aria-label`、`aria-selected`。
- 保持当前可见 focus ring 风格。

**涉及文件：**
- 修改：`src/App.tsx`
- 修改：`src/features/commands/command-palette.tsx`
- 修改：`src/features/file-tree/FileTreeSidebar.tsx`
- 修改：`src/features/editor/MarkdownEditor.tsx`
- 修改：`src/features/inspector/InspectorTabs.tsx`
- 修改：`src/styles/app.css`

**验收标准：**
- Escape 关闭 overlay 后回到编辑器 focus。
- Command Palette 和 Quick Open 支持方向键和 Enter。
- Inspector tabs 暴露正确 selected 状态。
- Toolbar buttons 都有 accessible name。

**验证方式：**
- 运行 `./node_modules/.bin/tsc --noEmit`
- 键盘链路检查：`Cmd+P`、方向键、Enter、`Cmd+Shift+P`、`Cmd+F`、Escape、`Cmd+S`。

## 全局验证命令

每完成 2-3 个功能运行一次：

```bash
./node_modules/.bin/vitest run
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vite build
cargo test --manifest-path src-tauri/Cargo.toml
```

本仓库优先使用 repo-local binaries，规避 pnpm ignored builds 策略带来的干扰。

## 视觉 QA 清单

- 1440x960 dark mode：标题栏、侧栏、编辑区、检查器 tabs、Command Palette。
- 1440x960 light mode：Madinah blog warm reader palette、编辑文本、预览文本、边框。
- 900x700：侧栏和检查器收缩后无文本碰撞。
- 680px：标题栏图标完整，编辑区 padding 可用。
- 右键菜单：保持在 viewport 内。
- 选区工具条：保持在 viewport 内。
- Preview mode：code block、table、callout、heading、link 渲染正确。

## 建议提交顺序

1. `feat(writer): clarify save state`
2. `refactor(writer): extract workbench state`
3. `feat(writer): add inspector tabs`
4. `fix(writer): compact writing stats`
5. `feat(writer): add preview mode`
6. `feat(writer): enrich command palette`
7. `feat(writer): align native view menu`
8. `feat(writer): add selection toolbar`
9. `feat(writer): organize editor context menu`
10. `feat(writer): improve insert commands`
11. `feat(writer): add markdown source mode`
12. `feat(writer): improve document search jumps`
13. `feat(writer): show file tree edit badges`
14. `feat(writer): surface plugin diagnostics`
15. `polish(writer): improve empty states`
16. `polish(writer): improve keyboard accessibility`
