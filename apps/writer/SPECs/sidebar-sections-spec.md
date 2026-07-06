# Sidebar Sections Spec

## Summary

Redesign the sidebar into three ordered sections: `Pinned`, `Recents`, and `Everything`. `Everything` keeps the existing file tree. `Pinned` shows files explicitly pinned from the sidebar. `Recents` shows workspace markdown files ordered by metadata (`modified_at`) without rescanning the workspace on every page request.

## Goals

- Keep the existing file tree behavior under an `Everything` section.
- Add a `Pinned` section above Recents for user-pinned files.
- Add a `Recents` section above Everything, sorted by file metadata recency.
- Add `Show More` controls for Pinned and Recents.
- Let each section collapse/expand from a caret in the section label row.
- Hide `Recents` for small workspaces with fewer than 10 indexed files.
- Show 4 recent files per page so Recents stays compact above the full tree.
- Preserve existing file row behaviors: open, active highlight, title-vs-filename setting, and context menu actions.
- Keep recent-file reads cheap by paging from an index-backed in-memory cache.

## Non-Goals

- Frontmatter-driven pins.
- Cross-workspace pins.
- A full workspace snapshot refactor.
- Per-section drag-and-drop or custom ordering.

## Data Source

### Recents

- Extend the existing Rust `IndexedFile` with `modified_at`.
- Populate `modified_at` during the existing background workspace index walk.
- Keep a per-window sorted recent-file cache derived from the index.
- Invalidate the cache when the index changes or a file's mtime changes.
- `read_recent_files(limit, offset)` returns a cached slice and extracts titles only for that returned page.
- Internal Writer saves must update the recent metadata path explicitly because watcher self-write events are suppressed.

### Pinned

- Persist pinned paths per workspace using Tauri Store preferences.
- Add sidebar Pin/Unpin actions for markdown files.
- Resolve visible pinned paths through `read_file_entries(paths)`, which stats and title-loads only requested paths.
- Filter missing or non-markdown paths when rendering.

## UX Decisions

- Section order: `Pinned`, `Recents`, `Everything`.
- Each 12px section label uses normal letter spacing and has a caret immediately to the right of the label text. Clicking the label row toggles the section body.
- Initial visible count: small enough to keep the tree prominent; `Show More` reveals/fetches the next page.
- Recents starts at 4 visible files and reveals 4 more per `Show More`; Pinned starts at 6 and reveals 6 more per page.
- Empty `Pinned` / `Recents` sections are hidden until they have entries.
- `Recents` is hidden while the workspace has fewer than 10 indexed files, even if recent metadata exists.
- Flat section rows use the same document label setting as the tree.
- Pinned rows expose an unpin affordance and file context menu.

## Implementation Notes

- Keep the current `FileTree` implementation as the owner of tree selection, rename, expansion, and folder context menus.
- Extract shared file context-menu wiring only where it avoids duplication for flat rows.
- Avoid per-render filesystem scans from React. Frontend should request paged data and refresh on index/watch/save signals.
- Do not persist recent files separately; recency comes from metadata.

## Acceptance Criteria

- Opening a workspace shows `Everything` with the same tree behavior as before.
- Files can be pinned and unpinned from the sidebar.
- Pinned files appear in `Pinned` across app restarts for the same workspace.
- `Recents` lists markdown files by descending metadata mtime once the workspace index is available.
- `Show More` reveals additional Pinned/Recents files without blocking the UI with workspace scans.
- Deleted pinned files do not render.
- Existing file context menu actions still work from tree rows.

## Validation

- Frontend: `vp check`, `vp test`.
- Rust: `cargo test`, `cargo clippy`, `cargo fmt --check` from `apps/desktop/src-tauri/`.
