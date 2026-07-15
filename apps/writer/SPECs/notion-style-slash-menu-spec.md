# Notion-style slash menu

## Goal

Make Writer's existing `/` command surface feel like a block editor menu: easy to scan before searching, descriptive while filtering, and fully usable from the keyboard.

## Scope

- Keep `EDITOR_COMMANDS` as the only command registry and preserve the current slash trigger and execution path.
- Group visible commands by writing block category in the unfiltered menu and in search results.
- Give each command a compact visual mark, label, and useful description.
- Show concise keyboard guidance and support Arrow Up/Down, Home/End, Enter/Tab, and Escape.
- Preserve viewport-aware placement, mouse selection, and selected-row scrolling.
- Add focused unit coverage for group ordering and visual metadata.

## Non-goals

- A separate command registry or React portal for slash commands.
- Drag-and-drop block reordering or a persistent block handle.
- Changing Markdown insertion semantics or the native context menu.

## Acceptance

- Typing `/` shows categorized commands with icons and descriptions.
- Typing a query filters the same commands and keeps matching results grouped.
- Keyboard navigation can jump to the first or last result and execute or dismiss the menu.
- Existing slash trigger, search, placement, and command tests continue to pass.
