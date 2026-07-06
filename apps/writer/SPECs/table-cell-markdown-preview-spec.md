# Table Cell Markdown Preview Spec

## Summary

Folded markdown table previews should parse inline markdown inside header and body cells. A table cell containing `**bold**`, `` `code` ``, `[links](...)`, or `~~strike~~` should display the rendered inline form instead of the raw delimiters.

## Goals

- Render common inline markdown inside folded table preview cells.
- Keep the existing unfolded source-editing behavior unchanged: touching a table still reveals raw markdown source in the main CodeMirror editor with codeblock styling.
- Avoid unsafe HTML injection from table cell contents.
- Reuse the editor's markdown parser extensions where practical so table-cell inline parsing does not drift from the rest of the editor.

## Non-Goals

- Rich visual table cell editing.
- Block-level markdown inside cells.
- Making links or images inside folded table previews navigate or load resources.

## Implementation Notes

- `table-decorations.ts` owns folded table preview rendering.
- The folded table widget should create DOM nodes directly rather than using `innerHTML`.
- Inline HTML in cells should remain text unless a future spec explicitly enables sanitized inline HTML rendering.

## Acceptance Criteria

- Folded table headers and body cells render bold, italic, inline code, links, strikethrough, escaped markdown characters, and decoded HTML entities.
- Unfolded table source decorations are unchanged.
- Tests cover rendered inline cell markdown and the no-HTML-injection behavior.
