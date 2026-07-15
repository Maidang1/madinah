# CodeMirror Removal

## Goal

Remove the inactive CodeMirror/ProseMark implementation left behind after the
Writer editing surface moved to TipTap, without changing the active TipTap
editor behavior.

## Scope

- Delete the unreachable CodeMirror editor, extensions, decorations, styles,
  search UI, tests, and E2E coverage.
- Keep the active TipTap slash menu, but own its supported command metadata in
  the TipTap command module instead of importing the legacy command executor.
- Remove CodeMirror, Lezer, and legacy renderer dependencies that no remaining
  source file imports.
- Update active architecture, shortcut, review, and render-contract docs to
  describe TipTap/ProseMirror.

## Verification

- No active source, test, package manifest, or maintained guide references
  CodeMirror/ProseMark.
- `vp check` and `vp test` pass for Writer.
