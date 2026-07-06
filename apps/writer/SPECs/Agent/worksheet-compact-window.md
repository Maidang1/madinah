# Agent Worksheet: Compact Window

## Task

Implement compact single-file windows: direct markdown-file opens use compact chrome with no sidebar, no sidebar toggle, no tabs, and a top dropdown containing the real sidebar navigation sections (`Pinned`, `Recents`, `Everything`).

Spec: [`SPECs/compact-window-spec.md`](../compact-window-spec.md)

## Reviewed

- `TODOS.md`
- `CHANGELOG.md`
- `docs/react-guidelines.md`
- `docs/consolidation.md`
- `docs/keyboard-shortcuts.md`
- `docs/workflows/agent-loop.md`
- `SPECs/sidebar-sections-spec.md`
- `SPECs/multi-window-spec.md`
- `apps/desktop/src/App.tsx`
- `apps/desktop/src/components/app-layout.tsx`
- `apps/desktop/src/components/editor-area/index.tsx`
- `apps/desktop/src/components/sidebar/file-browser.tsx`
- `apps/desktop/src/components/sidebar/file-tree.tsx`
- `apps/desktop/src/components/sidebar/file-tree-node.tsx`
- `apps/desktop/src/hooks/use-open-drop.ts`
- `apps/desktop/src/hooks/use-keyboard-shortcuts.ts`
- `apps/desktop/src/components/command-palette/index.tsx`
- `apps/desktop/src/stores/editor-store.ts`
- `apps/desktop/src/stores/workspace-store.ts`
- `apps/desktop/src-tauri/src/open_target.rs`
- `apps/desktop/src-tauri/src/commands/startup.rs`
- `apps/desktop/src-tauri/src/commands/workspace.rs`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/src/state.rs`

## Plan

- Add compact chrome state on the workspace store and route startup/runtime single-file opens into it.
- Keep one-window-per-workspace: a file open targeting an already-open workspace is routed to that existing window; normal workspace windows remain normal chrome.
- Extract reusable sidebar navigation sections from `FileBrowser` for full sidebar and compact dropdown reuse.
- Add a compact file-open action in the editor store that keeps a single file tab and prunes hidden tabs.
- Add a compact app layout that renders a top dropdown and `EditorArea`, without sidebar/toggle/tabs.
- Disable tab/sidebar commands in compact mode.
- Add targeted TS/Rust tests and run project validation.

## Notes

- The frontend test environment is Node-based, so component visual tests are less practical than store/action and IPC-helper tests.
- Compact mode is intentionally not session-persisted; it is derived from explicit file-open intent.

## Implementation Summary

- Added `workspace` / `compact-file` chrome mode to the workspace store.
- Added `openCompactFile` to the editor store to collapse editor state to one file tab while preserving normal file loading/saving.
- Routed startup and runtime file-open payloads into compact mode only when the current window is empty or already compact; full workspace windows stay full.
- Changed existing-window routing on the Rust side to focus and queue an open event, so existing workspace windows receive file/folder payloads.
- Extracted `SidebarNavigator` for shared Pinned, Recents, and Everything rendering.
- Added `CompactFileLayout` with a top dropdown and no sidebar/tabs.
- Disabled tab/sidebar/settings commands that would create hidden state in compact mode.

## Validation

- `vp install` — passed; lockfile already up to date.
- `vp check` — passed with two existing e2e warnings in `apps/desktop/e2e/`.
- `vp test` — passed, 27 files / 452 tests.
- `cargo test` from `apps/desktop/src-tauri/` — passed, 111 tests.
- `cargo clippy` from `apps/desktop/src-tauri/` — passed with existing warnings in unrelated files.
- `cargo fmt --check` from `apps/desktop/src-tauri/` — passed.
