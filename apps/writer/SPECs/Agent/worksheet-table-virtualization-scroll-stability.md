# Worksheet: Table Virtualization Scroll Stability

## Task

- User request: "there's an issue when scrolling documents with tables: as i scroll the size of the doc and scroll position/size changes suddenly. Look into the codemirror/prosemark editor"
- Spec: `SPECs/table-virtualization-scroll-stability-spec.md`
- TODO: `Table virtualization scroll stability`

## Reviewed

- `TODOS.md`
- `docs/editor.md`
- `docs/react-guidelines.md`
- `docs/consolidation.md`
- `docs/workflows/agent-loop.md`
- `apps/desktop/src/components/editor-area/table-decorations.ts`
- `apps/desktop/tests/table-decorations.test.ts`
- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts`
- `apps/desktop/src/components/editor-area/editor-scroll-container.tsx`
- `apps/desktop/src/lib/prosemark-core/fold/core.ts`
- `@codemirror/view` 6.40.0 `WidgetType` type definitions

## Findings

- Folded tables are `Decoration.replace({ block: true })` widgets spanning the parsed Markdown table.
- CodeMirror uses `WidgetType.estimatedHeight` for unmeasured block widgets in the heightmap. The default is `-1`, which falls back to one editor line height.
- A rendered table is usually much taller than one line. When scrolling brings the widget into the measured viewport, CodeMirror replaces the low estimate with the real height, changing the document height and outer scrollbar position.
- The actual scroll container is Writer's outer `EditorScrollContainer`; the table height estimate still belongs on the CodeMirror widget because that owns the heightmap.

## Plan

- Add a deterministic table height estimator in `table-decorations.ts`.
- Pass the estimate into `TableWidget` and expose it through `estimatedHeight`.
- Derive the estimate from parsed row count and the editor font-size default plus the table preview's own line-height/padding constants.
- Add focused tests for positive estimates and row-count scaling.
- Update changelog and move the TODO entry to Done after validation.

## Results

- Added a deterministic height estimator for folded table preview widgets in `table-decorations.ts`.
- `TableWidget` now exposes `estimatedHeight`, letting CodeMirror reserve a close height for unmeasured table widgets instead of falling back to one editor line.
- Reused the same table sizing constants for the estimate and the `EditorView.baseTheme` table CSS to avoid drift.
- Added focused tests for widget height estimates and row-count scaling.
- Validation:
  - `vp install` passed.
  - `vp test apps/desktop/tests/table-decorations.test.ts` passed: 9 tests.
  - `vp check` passed with two existing E2E JS warnings.
  - `vp test` passed: 27 files, 438 tests.
  - `cargo fmt --check` passed.
  - `cargo test` passed: 103 Rust tests.
  - `cargo clippy` passed with existing Rust warnings.
