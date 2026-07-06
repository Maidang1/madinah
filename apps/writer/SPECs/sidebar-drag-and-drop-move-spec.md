# Sidebar Drag-and-Drop Move Spec

## Summary

Let users move files and folders by dragging them within the sidebar's `Everything`
file tree. Dropping an item onto a folder re-parents it into that folder; dropping onto a
file targets the file's parent folder; dropping on empty tree space moves to the workspace
root. The tree stays auto-sorted — this is re-parenting only, not manual ordering.

## Goals

- Drag a file or folder in the `Everything` tree and drop it into another folder to move it.
- Forgiving drop targets: folder → into it, file → into its parent, empty space → root.
- Support dragging a multi-selection (Cmd/Shift-click) as one batch.
- Keep open tabs, pinned files, and expanded-folder state correct after a move.
- Reuse one write path for both inline rename and drag-move.

## Non-Goals

- Manual reordering / custom sort order within a folder.
- Dragging files in from / out to Finder (OS drag-drop). The existing Finder-drop-to-open
  behavior is preserved untouched.
- Dragging from the `Pinned` / `Recents` sections (those rows are not drag sources).
- Spring-loaded auto-expand of collapsed folders on hover (possible follow-up).

## Why pointer events, not HTML5 drag-and-drop

The Tauri window enables OS-level drag-drop (default) and uses it in `lib.rs`
(`WindowEvent::DragDrop`) to open files dropped from Finder. While that handler is active,
the WKWebView suppresses HTML5 `dragstart`/`dragover`/`drop` DOM events. Disabling it
(`dragDropEnabled: false`) is the only way to make HTML5 DnD fire, but that would regress
the Finder-drop-to-open feature. So drag is implemented with raw pointer events
(`pointerdown`/`pointermove`/`pointerup`), which are unaffected by the OS drag-drop config.

## Interaction

1. `pointerdown` settles selection up front (the mousedown-selection model): Shift/Cmd adjust
   the selection and never drag; a plain press on a row outside the current multi-selection
   discards that selection immediately. It then decides what a drag would carry — the whole
   multi-selection if the pressed row belongs to it, otherwise just that row. A plain click
   (no drag — drags suppress the click) opens/toggles the row. Settling selection at press
   time keeps drag and click from ever acting on a stale selection.
2. After the pointer moves past a 4px threshold the drag begins: a floating 1:1 copy of the
   grabbed row (same selected fill, size, indent, icon, and label) follows the cursor, plus a
   small count badge when several items are dragged; the dragged rows dim in place.
3. On move, the folder under the pointer is resolved to a destination and its "container"
   is highlighted with a soft background block — the destination folder row plus its visible
   descendants when expanded (the whole tree for the root), measured into one rounded
   rectangle rather than per-row outlines. The tree auto-scrolls near its top/bottom edge.
4. On `pointerup`, each dragged item is moved into the destination; the trailing click is
   suppressed so a drag never also opens a file. The destination folder is expanded so the
   moved items are visible.

## Validation

- A move is rejected (no highlight, no-op) when the destination is the item's current
  parent, or when a folder is dropped onto itself or one of its descendants.
- Name collisions are detected with `file_exists` before moving; a colliding item is
  skipped. After a batch, a single alert summarizes any skipped/failed items.

## Implementation

- `tree-move.ts` — pure helpers: `resolveDropDir`, `canMoveInto`, `computeMovePath`, and
  `resolveDropRange` (the destination folder's contiguous visible-descendant run, used to
  measure the highlight block) — unit-tested in `tests/tree-move.test.ts`.
- `use-move-entry.ts` — the single write path. `applyPathChange(entry, newPath)` renames on
  disk via `rename_entry`, rewrites editor/workspace state (open files, pins, and—for
  folders—expanded dirs), and refreshes both affected directories. `moveEntry(entry, destDir)`
  guards and collision-checks, then calls it. Inline rename in `file-tree.tsx` and
  `sidebar-navigator.tsx` now funnel through `applyPathChange`, removing the previously
  duplicated rename tail.
- `use-tree-drag.ts` — pointer-drag state machine: `beginDrag(event, entries, primary)` arms a
  drag for an already-decided set, then threshold, ghost positioning, row-geometry drop
  hit-testing (`rowPathAtY`), auto-scroll, click suppression, batch drop, and a layout effect
  that measures the drop-target container range into a `dropHighlight` rect. It owns drag only
  — selection lives in `file-tree.tsx` and is settled on pointer-down, so the two no longer
  coordinate through a shared ref at drag-start.
- During a drag, `body.tree-dragging` forces the grabbing cursor and sets `pointer-events: none`
  on the rows (`[data-tree-path]`). That keeps WebKit from leaving rows stuck in `:hover` as the
  cursor passes over them mid-drag; because the rows are then non-hit-testable, drop targeting
  uses row geometry (`rowPathAtY`) rather than `elementFromPoint`.
- `drag-ghost.tsx` — the cursor-following 1:1 copy of the grabbed row (selected fill, size,
  indent, icon, label) plus a multi-item count badge; `file-tree-icons.tsx` holds the shared
  file/folder glyphs used by both tree rows and the ghost.
- `file-tree.tsx` / `file-tree-node.tsx` — wire the container ref, per-row `onPointerDown`,
  the `isDragging` dim, and the single drop-highlight block rendered behind the rows. Drag
  props are only passed by `FileTree`, so `Pinned`/`Recents` rows stay non-draggable.

## Backend

No Rust changes. `rename_entry` (`std::fs::rename`) is the move primitive, and the watcher
emits `fs:directory-changed` for both the source and destination directories, keeping other
windows and external state in sync. The immediate `refreshDirectory` calls make the active
window update instantly.
