# List Prefix Interaction Zones

## Problem

The measurable list-prefix renderer fixed visual selection, but caret and
Backspace behavior can still expose hidden source positions inside indentation
or marker text. Users should not have to reason about invisible spaces or the
characters inside `- ` / `- [ ] `.

## Behavior

For unordered and task-list lines, the only valid caret positions before the
body are:

- The line start, before all indentation.
- The marker start, after all indentation and before `- ` / `- [ ] `.
- The body start, after the marker.
- Any position inside the body text.

Collapsed carets that land inside indentation or marker source are clamped to a
valid boundary. Non-empty selections are not clamped, preserving the stable drag
selection behavior from the list selection geometry revamp.

Backspace behavior is source-zone based:

- At body start, a nested item removes the marker and one indent level.
- At body start, a top-level item removes only the marker.
- At marker start, a nested item removes one indent level.
- At marker start on a top-level item, Backspace falls through.
- In body text, Backspace falls through.

Tab and Shift-Tab over a multi-line selection operate on each selected
unordered/task line while leaving non-list lines unchanged.
