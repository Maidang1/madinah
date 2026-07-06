# Global-Scoped Compact Mode

## Problem

Compact mode is workspace-scoped: it requires an open workspace root, its picker
lists workspace pinned/recent files from the file index, and a single-file open
via CLI/drag-drop bootstraps a full workspace (watcher + gitignore + index walk)
even though only one file is shown. That makes single-file opens slower than
they need to be and couples the compact window to a folder the user never asked
to open.

## Goal

Make compact mode 100% global:

- A compact window opens a single markdown file by absolute path with **no
  workspace**: no root, no file/folder indexing, no recursive watcher.
- The compact picker lists a **global recents** list — every file opened
  anywhere in the app (any window, any mode), persisted in the app data dir,
  capped at 30, most-recent-first, pruned of nonexistent files on read.
- The open file is still watched for external changes via a lightweight
  watcher on its parent directory (non-recursive).
- This **replaces** workspace-scoped compact chrome: a window with a workspace
  root always renders workspace chrome. The `appearance.compact-mode` setting
  and its palette toggle are removed; a new workspace-mode palette command
  "Open File in Compact Window" opens the active file standalone.

## Design

### Backend

- `PendingOpenPayload.workspace` becomes `Option<String>`; `classify()` of a
  markdown file yields `{workspace: None, file: Some(canonical)}`.
- `get_startup_state` with a file-only payload skips `build_restore_bundle`
  and returns `StartupState.standalone_file: Option<FileContent>` (prefetched),
  plus starts the single-file watcher.
- New `commands/recents.rs`: `record_recent_file`, `get_recent_files_global`
  over `app_data_dir/recent_files.json`, serialized by
  `AppState.recent_files_lock`.
- New `watch_standalone_file(path)` IPC and `start_file_watcher` in
  `watcher.rs` (parent-dir non-recursive watch, same `fs:file-changed`
  payload, self-write suppression; survives atomic temp+rename saves).
- New `open_file_in_standalone_window(path)` IPC; file-only payloads from
  single-instance argv and macOS `RunEvent::Opened` route there on warm
  start. Same-file opens focus the existing window
  (`AppState::find_by_standalone_file`, backed by
  `WorkspaceState.standalone_file`).

### Frontend

- Chrome mode = the store's `chromeMode`; `"compact-file"` only occurs with
  `root === null`. `App.tsx` renders compact layout when no root and chrome
  mode is compact.
- Global recents recorded from a module-level `useEditorStore` subscription
  on `activeFilePath` (`src/lib/global-recents.ts`).
- Compact picker renders the global recents list plus an "Open other file…"
  dialog row instead of `SidebarNavigator`.
- Command palette in standalone mode filters global recents client-side
  (no fuzzy index); "Create New File" creates a sibling of the active file.
- Drag-drop: a file dropped on a workspace window opens a standalone compact
  window; a folder dropped on a compact window opens a new workspace window.

## Known behavior

- External rename of the open standalone file leaves the buffer on the old
  path; the next save recreates the old name (same as workspace behavior).
- Deleting the open file externally keeps the buffer; the next save recreates
  the file.
