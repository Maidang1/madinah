# Worksheet: Table Unfold Codeblock

## Task

- User request: "when i unfold a table, the code isn't displayed in a code editor, fix it"
- Final intent: no nested editor; show unfolded table markdown as codeblock-styled source in the main editor.
- Spec: `SPECs/table-unfold-codeblock-spec.md`

## Reviewed

- `TODOS.md`
- `docs/editor.md`
- `docs/consolidation.md`
- `docs/react-guidelines.md`
- `apps/desktop/src/components/editor-area/table-decorations.ts`
- `apps/desktop/src/components/editor-area/mermaid-decorations.ts`
- `apps/desktop/src/lib/prosemark-core/fold/core.ts`
- `apps/desktop/src/components/editor-area/prosemark-theme.css`
- Existing tests under `apps/desktop/tests/`

## Findings

- Tables used a replace-only widget and returned `undefined` when `selectionTouchesRange` was true.
- Because the fold spec did not set `keepDecorationOnUnfold`, ProseMark dropped the table decoration in the touched state and the raw source rendered as ordinary prose.
- The desired behavior is a main-editor codeblock surface, not a nested CodeMirror editor.

## Plan

- Set `keepDecorationOnUnfold: true` for the table fold spec.
- Keep the existing replace widget for folded preview.
- Return line decorations for touched tables so the source stays visible and gets codeblock styling.
- Reuse the existing code font and code background tokens.
- Add focused tests for folded and unfolded decoration states.

## Results

- Implemented table source-line decorations for the unfolded state.
- Added `apps/desktop/tests/table-decorations.test.ts`.
- Updated `docs/editor.md`, `CHANGELOG.md`, and `TODOS.md`.
- Validation:
  - `vp check` passed with two existing E2E JS warnings.
  - `vp test` passed: 24 files, 396 tests.
  - `cargo fmt --check` passed.
  - `cargo test` passed: 103 Rust tests.
  - `cargo clippy` passed with existing warnings.
  - `vp dev --host 127.0.0.1` served the app at `http://127.0.0.1:1420/`; `curl` returned the Writer HTML shell.
