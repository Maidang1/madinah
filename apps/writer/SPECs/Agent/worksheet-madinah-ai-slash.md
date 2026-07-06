# Worksheet: Madinah AI And Slash Migration

## TODO

- In Progress: Madinah AI and slash capability migration: [`SPECs/madinah-ai-slash-spec.md`](../madinah-ai-slash-spec.md)

## Reviewed

- `TODOS.md`
- `docs/workflows/agent-loop.md`
- `apps/desktop/src/components/command-palette/index.tsx`
- `apps/desktop/src/components/editor-area/editor-context-menu.ts`
- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts`
- `apps/desktop/src/components/editor-area/markdown-formatting.ts`
- `apps/desktop/src/hooks/editor-api.ts`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src-tauri/src/commands/mod.rs`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/src/commands/asset_upload.rs`
- `apps/desktop/src/components/settings-panel/index.tsx`
- `apps/desktop/src/components/settings-panel/asset-upload-section.tsx`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/domain/ai-polish.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/ai-polish/settings.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/ai-polish/command.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/electron/main/backend.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/editor/slash-commands.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/editor/slash-commands.test.ts`
- `/Users/bytedance/codes/myself/madinah/apps/writer/src/styles/app.css`
- `/Users/bytedance/codes/myself/madinah/apps/writer/node_modules/@agentclientprotocol/sdk/schema/schema.json`
- `/Users/bytedance/codes/myself/madinah/node_modules/.pnpm/@agentclientprotocol+sdk@1.1.0_zod@4.4.3/node_modules/@agentclientprotocol/sdk/dist/acp.d.ts`

## Baseline

- `./node_modules/.bin/vp check`: exit 0 with existing warnings in `apps/desktop/e2e/wdio.conf.js` and `apps/desktop/e2e/specs/smoke.spec.js`.
- `./node_modules/.bin/vp test`: passed, 31 files and 484 tests.
- `cargo test`: passed, 125 tests.
- `cargo clippy`: exit 0 with existing Rust warnings.
- `cargo fmt --check`: passed.

Commands used `PATH=/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/bytedance/.cache/codex-runtimes/codex-primary-runtime/dependencies/bin:$PATH` for Vite+ because the shell has no global `node`. The project-local `./node_modules/.bin/vp` is the working Vite+ entry.

## Findings

- The current fork already has a right-click command dispatcher through `onRunCommand` and a registry-like map for formatting and insert commands.
- The old AI implementation supports four actions. The first migration should ship the direct editing actions: full-document polish and selection rewrite.
- Old AI settings contain provider, command, environment variables, instruction, and timeout. Defaults are Codex ACP and Claude ACP via `npx -y @agentclientprotocol/...`.
- Old ACP result handling uses `MADINAH_WRITER_RESULT_START` and `MADINAH_WRITER_RESULT_END`, which should be preserved.
- The old slash surface is mostly pure logic: command item creation, search scoring, trigger matching, menu placement, and trigger replacement. Current CodeMirror can host a light DOM menu extension using the same shape.
- Sub-agent plan review was skipped because the current multi-agent tool policy requires explicit user authorization for spawning agents.

## Plan

1. Add Rust AI command module for settings normalization, persistence, prompt construction, result-envelope parsing, command parsing/spawn boundary, and ACP check/run IPC.
2. Add TypeScript IPC wrappers and AI operation status store.
3. Add Preferences AI section using the same explicit Save/Check pattern as Asset Upload.
4. Add editor AI command helpers for document polish and selection rewrite.
5. Add slash-command pure helpers and CodeMirror extension that shares the same command map as the context menu.
6. Add unit tests for backend prompt/settings parsing and frontend slash/helper behavior.

## Risks

- A full ACP client in Rust is larger than this slice. The first implementation should isolate the process boundary and prompt/result contract so a future dedicated ACP client can replace the runner without changing editor commands.
- Some ACP agents may require interactive auth. The check action should report the backend error directly.
- Slash menu DOM ownership must clean up on editor destroy, blur, Escape, and document changes.

## Implementation

- Added `apps/desktop/src-tauri/src/commands/ai.rs` with AI settings persistence, Codex/Claude ACP defaults, env parsing, timeout normalization, ACP prompt building, result-envelope extraction, a minimal JSON-RPC ACP client, permission cancellation, and child-process cleanup on timeout.
- Registered `load_ai_settings`, `save_ai_settings`, `check_ai_settings`, and `run_ai_action` in Tauri.
- Added typed frontend wrappers in `apps/desktop/src/lib/tauri.ts` and AI settings helpers in `apps/desktop/src/lib/ai.ts`.
- Added `AiSettingsSection` to Preferences with provider selection, command, timeout, env, instruction, Save, and Check.
- Added shared editor command registry in `apps/desktop/src/components/editor-area/editor-commands.ts`, with formatting/insert commands plus `ai.rewriteSelection` and `ai.polishDocument`.
- Added AI operation status banner/store for running, success, and error feedback.
- Added slash-command pure helpers and a CodeMirror extension for `/` trigger matching, command search, keyboard navigation, fixed-position menu rendering, and shared command execution.
- Added frontend and Rust tests for AI settings helpers, IPC wrappers, slash search/trigger/position behavior, menu structure, backend settings normalization, prompt construction, output normalization, and ACP update parsing.

## Review

- Manual review completed for child-process cleanup, shared command dispatch, slash menu lifecycle, and AI settings persistence.
- Sub-agent plan and implementation reviews were skipped because the current multi-agent tool policy requires explicit user authorization for spawning agents.

## Results

- `./node_modules/.bin/vp check`: exit 0 with the existing e2e JS warnings noted in Baseline.
- `./node_modules/.bin/vp test`: passed, 33 files and 496 tests.
- `./node_modules/.bin/vp run desktop#build`: passed.
- `cargo test`: passed, 132 tests.
- `cargo clippy`: exit 0 with the existing Rust warnings noted in Baseline plus the same existing clippy suggestions.
- `cargo fmt --check`: passed.
- `git diff --check`: passed.
