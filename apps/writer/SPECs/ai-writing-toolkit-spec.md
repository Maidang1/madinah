# AI Writing Toolkit

## Goal

扩展 Writer 的 Codex SDK 写作能力，让用户可以在同一编辑器工作流内完成续写、压缩、扩展、翻译和结构规划。

## Capabilities

| Action              | Input        | Result                     |
| ------------------- | ------------ | -------------------------- |
| Continue writing    | 光标前后正文 | 在光标处插入后续 Markdown  |
| Shorten selection   | 当前选区     | 替换为更简洁的 Markdown    |
| Expand selection    | 当前选区     | 替换为更完整的 Markdown    |
| Translate selection | 当前选区     | 自动中英互译并替换         |
| Generate outline    | 当前全文     | 在光标处插入 Markdown 大纲 |

## Interaction contract

- 选区动作在空选区时给出明确错误。
- 全文动作在空文档时给出明确错误。
- AI 运行期间沿用现有 operation banner。
- 成功写入形成单次 CodeMirror transaction，可通过 Undo 撤销。
- 返回内容保持 Markdown，生成结果不带解释和代码围栏。

## Architecture

- 前端动作定义进入共享编辑器命令注册表；选区动作出现在右键菜单，续写、大纲和全文动作同时进入右键与斜杠菜单。
- 选区替换和光标插入分别通过共享执行器完成。
- Rust 后端以动作描述注册表统一合法动作、prompt 与输出 schema。
- 所有动作沿用 Codex SDK 的只读沙箱、禁止审批升级和关闭 Web 搜索设置。

## Acceptance criteria

- 五项能力在适用上下文中可发现、可执行、可撤销。
- 原有润色、重写、元数据和审查行为保持可用。
- 前端 IPC 类型、Rust 动作白名单和 prompt 测试覆盖新增能力。
- Writer 检查、测试、构建以及 Rust 测试通过。

## Status

Delivered on 2026-07-12.
