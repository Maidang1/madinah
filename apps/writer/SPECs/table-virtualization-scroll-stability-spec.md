# Table Virtualization Scroll Stability Spec

## Summary

Folded markdown tables should not cause sudden document height or scrollbar jumps when scrolling. CodeMirror should have a close table-widget height estimate before the widget is measured in the viewport.

## Goals

- Keep the outer editor scroll height stable while documents with folded table previews are virtualized.
- Preserve the current folded table preview and touched-table source-editing behavior.
- Keep the estimate deterministic and derived from the same parsed table data used to render the preview.
- Cover the estimate with focused tests so future table style changes account for scroll stability.

## Non-Goals

- Rich table editing.
- Horizontal table virtualization.
- Pixel-perfect prediction for every possible wrapped cell value.

## Implementation Notes

- `apps/desktop/src/components/editor-area/table-decorations.ts` owns folded table widget rendering.
- CodeMirror `WidgetType.estimatedHeight` is the intended API for reserving space for unmeasured block widgets in the heightmap.
- The estimate should account for the table header, body rows, borders, and widget padding using the editor font-size default plus the table preview's own line-height/padding constants.

## Acceptance Criteria

- Folded table widgets provide a positive estimated height before DOM measurement.
- The estimate grows with table row count.
- Existing folded/unfolded table behavior remains unchanged.
- Focused table decoration tests pass.
