# Worksheet: Frontmatter Properties Sidebar

## Task

Move frontmatter editing from the document body into a default-collapsed right-side properties inspector.

## Reviewed

- `TODOS.md`
- `docs/react-guidelines.md`
- `docs/editor.md`
- `docs/consolidation.md`
- `apps/desktop/src/components/editor-area/editor-pane.tsx`
- `apps/desktop/src/components/editor-area/frontmatter-panel.tsx`
- `apps/desktop/src/components/editor-area/use-frontmatter-entries.ts`
- `apps/desktop/src/lib/frontmatter-schema.ts`
- `apps/desktop/src/components/command-palette/index.tsx`
- Existing tests for frontmatter, YAML entries, editor API, command palette, and editor context menus.

## Plan

- Add a non-persisted document-inspector UI state in the existing UI store, surfaced through a domain hook.
- Render a right-side `DocumentInspector` from `EditorPane`, with an icon toggle and a properties panel using the existing frontmatter row editor.
- Remove the body-mounted `FrontmatterPanel` from the editor scroll area.
- Allow the properties panel to create empty frontmatter for documents that have none.
- Render known Madinah frontmatter fields with typed controls driven by a
  frontmatter TS schema.
- Add a command palette entry for Show/Hide Properties.
- Add focused unit tests for the new state logic and command registration, then run `vp check` and `vp test`.

## Notes

- Existing unrelated WIP is present in the worktree; keep edits scoped to this task.
- AI Review stays as a floating overlay and should remain visually above the inspector.

## Implementation

- Added UI-store-backed document inspector state and a domain hook for opening, closing, toggling, and closing on active-file changes.
- Removed the body-mounted `FrontmatterPanel` from `EditorPane` and added a right-side `DocumentInspector` with icon toggle, Escape close, mobile backdrop, and frontmatter form content.
- Extended `FrontmatterPanel` to support an inspector density and to create empty frontmatter when the document has no properties.
- Added a typed frontmatter schema that maps `status` to a select enum, `pubDate`
  to a date-time input, `tags` to YAML-list editing, and `description` to a
  multiline field while leaving custom keys as text.
- Added a command-palette Properties command via a pure command builder so the command registration is testable.

## Validation

- `vp test apps/desktop/tests/stores.test.ts apps/desktop/tests/command-palette.test.ts` — passed.
- `vp test apps/desktop/tests/frontmatter-schema.test.ts apps/desktop/tests/yaml-entries.test.ts apps/desktop/tests/stores.test.ts apps/desktop/tests/command-palette.test.ts` — passed, 4 files / 87 tests.
- `vp fmt --check` on task-owned files — passed.
- `vp test` — passed, 36 files / 521 tests.
- `vp lint` — passed with two existing unrelated e2e warnings.
- `vp exec tsc --noEmit` from `apps/desktop` — passed.
- `vp check` — blocked by pre-existing formatting issue in untracked `apps/desktop/tests/mdx-support.test.ts`, outside this task.
- `git diff --check` on task-owned files — passed.
