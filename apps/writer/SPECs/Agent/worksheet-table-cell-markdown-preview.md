# Worksheet: Table Cell Markdown Preview

## Task

- User request: "can you please parse the markdown inside table cells?"
- Spec: `SPECs/table-cell-markdown-preview-spec.md`
- TODO: `Table cell markdown preview`

## Reviewed

- `TODOS.md`
- `docs/editor.md`
- `docs/react-guidelines.md`
- `docs/consolidation.md`
- `docs/workflows/agent-loop.md`
- `SPECs/table-unfold-codeblock-spec.md`
- `SPECs/Agent/worksheet-table-unfold-codeblock.md`
- `apps/desktop/src/components/editor-area/table-decorations.ts`
- `apps/desktop/tests/table-decorations.test.ts`
- `apps/desktop/node_modules/@lezer/markdown/README.md`
- `apps/desktop/node_modules/@lezer/markdown/dist/index.d.ts`

## Findings

- Folded table preview rendering is manual: `TableWidget` builds a `<table>` and sets `textContent` for each header/body cell.
- Unfolded table source editing already goes through line decorations and should not change for this task.
- Lezer's GFM table parser already parses table cell contents as inline markdown, and the local parser can be configured with the same ProseMark inline extensions used by the main editor.

## Plan

- Keep the existing folded/unfolded decoration shape.
- Add a local safe inline renderer for table cell preview DOM, backed by the Lezer markdown parser plus ProseMark syntax extensions.
- Render common inline nodes directly to DOM (`strong`, `em`, `code`, styled link spans, strikethrough, escapes/entities).
- Update the existing table decoration tests to assert the rendered cell model and HTML safety.

## Results

- Implemented a safe inline table-cell render model in `table-decorations.ts`, backed by Lezer's markdown parser configured with GFM and the editor's ProseMark markdown extensions.
- Folded table previews now render bold, italic, inline code, links, strikethrough, escaped characters, entities, dash folds, and emoji folds inside cells. Links are visual spans with inert `data-href`; inline HTML remains text.
- Tightened table cell splitting so escaped pipes stay inside a cell.
- Added focused tests in `apps/desktop/tests/table-decorations.test.ts`.
- Validation:
  - `vp test apps/desktop/tests/table-decorations.test.ts` passed: 5 tests.
  - `vp check` passed with two existing E2E JS warnings.
  - `vp test` passed: 24 files, 398 tests.
  - `cargo fmt --check` passed.
  - `cargo test` passed: 103 Rust tests.
  - `cargo clippy` passed with existing warnings.
