# Codex SDK Migration

## Goal

Writer 的编辑器 AI 由 Tauri Rust 后端直接调用 `codex-client-sdk`，统一使用 Codex，并移除 Claude ACP 与通用 ACP 进程配置。

## User-visible behavior

- 编辑器继续提供全文润色、重写选区、生成元数据和文章审查。
- AI 设置聚焦 Codex 所需配置，连接检查验证 SDK 可用性。
- 操作状态、错误提示和结果应用方式保持一致。

## Engineering constraints

- 认证信息由 Codex SDK 的官方机制处理。
- 结构化输出继续在 Rust 边界解析和校验。
- 调用遵守配置的超时时间，任务结束后释放会话资源。
- Codex thread 使用只读沙箱、禁止审批升级、关闭 Web 搜索，并允许非 Git 写作目录。
- 迁移不得改动当前工作区内的一键发布与 Web 端未提交实现。

## Acceptance criteria

- Claude ACP 的运行时、默认配置、前端选项和测试全部移除。
- Rust 代码通过 `codex-client-sdk` 完成一次完整请求并消费响应事件。
- 四种 AI 动作的输入与结果契约保持可用。
- Writer 前端检查、测试与 Rust 测试通过。

## Delivered

- 固定使用 `codex-client-sdk 0.107.0`，通过 `Codex::new`、`start_thread` 和 `Thread::run` 执行动作。
- AI 设置升级为 schema v2：可选 Codex CLI 路径、可选模型、写作指令和超时。
- 旧配置自动迁移 Codex 指令与超时，Claude、ACP command 和环境变量退出新设置结构。
- 元数据和审查使用 SDK JSON Schema；润色和选区重写直接消费最终响应。
