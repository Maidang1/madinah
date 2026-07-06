# Madinah AI And Slash Migration

## Goal

Bring the useful AI writing and slash-command surfaces from the old Madinah writer into the current Tauri fork, using the current editor command path instead of the old Electron app shell.

Reference implementation:

- Old AI domain: `/Users/bytedance/codes/myself/madinah/apps/writer/src/domain/ai-polish.ts`
- Old AI settings: `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/ai-polish/settings.ts`
- Old AI commands: `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/ai-polish/command.ts`
- Old ACP backend: `/Users/bytedance/codes/myself/madinah/apps/writer/electron/main/backend.ts`
- Old slash helpers: `/Users/bytedance/codes/myself/madinah/apps/writer/src/features/editor/slash-commands.ts`
- Current command surface: `apps/desktop/src/components/editor-area/editor-context-menu.ts`
- Current editor hook: `apps/desktop/src/components/editor-area/use-prosemark-editor.ts`

## Scope

This slice owns the first usable migration:

- Add persisted AI agent settings for Codex ACP and Claude ACP providers.
- Keep agent command, environment variables, instruction, and timeout owned by the Rust backend.
- Add Tauri IPC commands to load/save/check settings and run AI actions.
- Support AI document polish and AI selection rewrite from the editor.
- Add a Preferences section for AI provider configuration.
- Add right-click AI actions through the existing editor context-menu command dispatcher.
- Add a slash-command surface for writing and AI commands that runs the same command functions as the right-click menu.

## Out Of Scope

- Full custom MCP management.
- AI-generated frontmatter metadata editing.
- AI document review side panel.
- Agent tool permission approval UI.
- Remote model account setup or login.

## Constraints

- Keep process spawning in Rust/Tauri, not in React.
- Preserve Markdown, MDX/JSX components, code fences, links, and factual meaning in AI prompts.
- Use the old Madinah result envelope markers so diagnostic output can be ignored safely.
- Keep slash commands as a focused writing surface with command filtering, keyboard navigation, Escape close, and Enter run.
- Share command execution between context menu and slash menu.
- Keep API keys and environment values outside the generic schema-driven settings store.

## Acceptance

- Preferences can load, save, normalize, and check AI agent settings.
- Right-click can polish the full document or rewrite the selected Markdown.
- Typing `/` opens a slash menu with writing commands and AI commands; query text filters the list.
- Running a slash command removes the slash trigger and applies the command at the editor selection.
- AI actions show running/success/error status and replace only the intended range.
- Tests cover settings normalization, prompt/result parsing, slash trigger matching/search/replacement, and command execution helpers.
- Baseline and final validation are recorded in the worksheet.
