# Notion-style slash menu

## Goal

Make Writer's active TipTap editor expose a `/` command surface that feels like a block editor menu: easy to scan before searching, descriptive while filtering, and fully usable from the keyboard.

## Scope

- Reuse slash presentation metadata from `EDITOR_COMMANDS`, but execute supported block transforms through TipTap command chains.
- Derive the active trigger and replacement range from ProseMirror state rather than the inactive CodeMirror extension.
- Group visible commands by writing block category in the unfiltered menu and in search results.
- Give each command a compact visual mark, label, and useful description.
- Show concise keyboard guidance and support Arrow Up/Down, Home/End, Enter/Tab, and Escape.
- Preserve viewport-aware placement, mouse selection, and selected-row scrolling.
- Render the portal menu on an opaque, theme-aware card so editor content never shows through it.
- Add focused unit coverage for group ordering and visual metadata.

## Non-goals

- Duplicating slash labels, descriptions, icons, or search metadata outside `EDITOR_COMMANDS`.
- Drag-and-drop block reordering or a persistent block handle.
- Changing Markdown insertion semantics or the native context menu.

## Acceptance

- Typing `/` shows categorized commands with icons and descriptions.
- Typing a query filters the same commands and keeps matching results grouped.
- Keyboard navigation can jump to the first or last result and execute or dismiss the menu.
- Existing slash trigger, search, placement, and command tests continue to pass.
- Executing an item removes the trigger and changes the current TipTap block in one transaction.
- The menu remains fully opaque over code blocks and other high-contrast document content.
