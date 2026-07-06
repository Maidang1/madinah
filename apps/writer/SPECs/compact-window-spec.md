# Compact Window Spec

## Summary

When Writer is opened directly on a markdown file, the resulting window uses a compact chrome: no sidebar, no sidebar toggle, no tab strip, and a top file dropdown for navigating the parent workspace. The dropdown reuses the actual sidebar navigation sections: `Pinned`, `Recents`, and `Everything`.

## Goals

- Use compact chrome for explicit single-file opens that hydrate their own window.
- Keep normal workspace windows full-width with the existing sidebar and tabs.
- Preserve the existing one-window-per-workspace behavior: if the parent workspace is already open, focus/reuse that full workspace window instead of creating a compact duplicate.
- Keep compact windows in compact mode when navigating to another file from the dropdown.
- Let the compact dropdown navigate with the same sidebar data sources and tree expansion state as the full sidebar.

## Non-Goals

- Persist compact mode as part of saved workspace sessions.
- Add separate compact-window dimensions or size preferences.
- Add file-management actions to the compact dropdown.
- Allow hidden tab accumulation in compact mode.

## UX Decisions

- The compact dropdown is navigation-only. It shows `Pinned`, `Recents`, and `Everything` with section collapse, active-file highlighting, folder expansion, and Show More pagination.
- Selecting any file from the dropdown replaces/navigates the one visible editor document and closes the dropdown.
- Opening a folder for the same parent workspace while a compact window is active switches that window back to normal workspace chrome.
- Single-file opens into an already-open normal workspace use that workspace window and remain normal chrome.

## Implementation Notes

- Add a frontend workspace chrome mode derived from startup/runtime open payloads: `workspace` by default and `compact-file` for single-file opens.
- Reuse the editor's existing file-tab internals for save/watcher/editor behavior, but funnel compact navigation through an action that keeps only one file tab visible.
- Extract shared sidebar navigation rows from `FileBrowser` so full sidebar and compact dropdown do not duplicate Pinned/Recents/Everything data flow.
- Disable or reroute tab/sidebar chrome commands in compact mode so invisible state is not created.

## Acceptance Criteria

- Cold-opening a markdown file shows compact chrome with no sidebar, sidebar toggle, or tab strip.
- The top dropdown shows Pinned, Recents, and Everything using real workspace data.
- Selecting a file from the dropdown changes the editor document and keeps compact chrome active.
- Cmd+\\, Cmd+T, tab cycling, and tab jumping do not create or manipulate hidden compact tabs.
- Opening a file whose parent workspace is already open reuses the normal workspace window.
- Opening the compact window's parent folder switches that window to normal workspace chrome.

## Validation

- Frontend: `vp check`, `vp test`.
- Rust: `cargo test`, `cargo clippy`, `cargo fmt --check` from `apps/desktop/src-tauri/`.
