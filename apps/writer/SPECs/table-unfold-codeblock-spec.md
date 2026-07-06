# Table Unfold Codeblock Spec

## Summary

When a rendered markdown table is unfolded, keep editing in the main CodeMirror document but display the table source with the same codeblock-style treatment used for fenced code lines. This makes the raw table source read as code without embedding a nested editor.

## Goals

- Keep the existing rendered table preview when the selection is outside the table.
- When the selection touches the table, show the markdown source in place and style each table line as a codeblock line.
- Preserve normal outer-editor editing, selection, undo, clipboard, and parsing behavior.
- Avoid nested CodeMirror instances for tables.

## Non-Goals

- Visual table cell editing.
- A table-specific toolbar or toggle button.
- A nested source editor.

## Implementation Notes

- `table-decorations.ts` sets `keepDecorationOnUnfold: true` so the table extension owns the touched-table state instead of letting ProseMark drop the fold decoration.
- The folded state remains a `Decoration.replace` widget over the full `Table` node.
- The unfolded state returns one `Decoration.line` per table source line with `cm-table-source-line` classes.
- If edits make the syntax tree stop recognizing the block as a table, it naturally falls back to ordinary markdown until the source is repaired.

## Acceptance Criteria

- Clicking or selecting into a rendered table reveals the raw table markdown in a codeblock-like surface.
- The revealed source is edited directly in the main editor.
- Moving the selection outside the table returns to the rendered table preview.
- Tests cover both folded preview and unfolded source-line decorations.
