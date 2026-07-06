# List Selection Geometry Revamp

## Problem

Unordered and task-list selection is still brittle during horizontal drag
selection. The current renderer keeps the markdown prefix in a clipped
zero-inline-width span and renders the visible bullet or checkbox as a point
widget. That avoids the older replace-widget boundary snap, but it still leaves
CodeMirror and the browser measuring a line that mixes collapsed source text,
widget boxes, line padding, and negative text indent.

The visible failure is that horizontal drag selection across bullet and task
lines can briefly select the full line, then settle back to the intended range.

## Behavior

- Bullet and task prefixes render as measurable source-backed mark spans, not
  widgets.
- The real markdown prefix remains in the DOM and in normal inline flow so
  CodeMirror hit-testing and drawn selection geometry see stable inline boxes.
- The prefix text is visually hidden with transparent text, not zero width or
  zero font size.
- The bullet or checkbox is drawn by CSS on the prefix span.
- Nested bullet and task prefixes use the same depth-aware prefix width as the
  existing renderer, so wrapped body text continues to align at the list body
  column.
- Keyboard semantics keep using source ranges: Backspace at the prefix edge,
  Enter continuation, Tab/Shift-Tab nesting, and checkbox toggles still mutate
  real markdown.

## Validation

- Drag-select horizontally across bullet-list body text; selection should track
  the pointer without selecting the full line first.
- Drag-select horizontally across task-list body text and across the checkbox
  area; selection should continue normally and not toggle the checkbox.
- Place the caret after empty `- ` and `- [ ] ` items; it should remain visible
  at the body column.
- Toggle top-level and nested tasks by clicking the checkbox.
- Verify nested task checkboxes align with nested bullets and wrapped body text.
- Run `vp check` and `vp test`.
