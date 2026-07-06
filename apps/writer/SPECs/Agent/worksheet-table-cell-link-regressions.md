# Worksheet: Table Cell Link Regressions

## Task

- User report:
  - "clicking on links is unfolding the code rather than navigating to"
  - "links like these arent parsed correctly `[[Format your notes\|Formatting]]`"
- Spec: `SPECs/table-cell-link-regressions-spec.md`

## Reviewed

- `TODOS.md`
- `apps/desktop/src/components/editor-area/table-decorations.ts`
- `apps/desktop/src/components/editor-area/use-prosemark-editor.ts`
- `apps/desktop/src/components/editor-area/wiki-link-extension.ts`
- `apps/desktop/src/lib/wiki-links.ts`
- `apps/desktop/tests/table-decorations.test.ts`
- `apps/desktop/tests/wiki-links.test.ts`

## Findings

- Table-cell markdown links were rendered as `.cm-rendered-link` spans with `data-href`, but `linkNavigationExtension` ignored that payload and tried to recover the URL from a source position. That fails inside `Decoration.replace` table widgets, so the table widget's click-to-unfold behavior wins.
- Wiki links are not Markdown syntax. Lezer parses `[[Format your notes\|Formatting]]` as a normal `Link` nested between stray brackets, so the table-cell Markdown renderer cannot infer the Obsidian target/alias unless it gets a table-cell-specific wiki parser.
- `parseWikiLink` already handles table-escaped alias separators correctly; table cells need to reuse that logic.

## Plan

- Add a table-cell-only wiki inline parser before Lezer's normal `Link` parser.
- Render parsed table-cell wiki links as `.cm-wiki-link` spans with `data-wiki-target`.
- Update `linkNavigationExtension` and `wikiLinkClickHandler` to prefer widget payloads before source-position lookup.
- Add focused tests for standard link payloads and escaped-pipe wiki aliases.

## Results

- Added a table-cell-only `WikiLink` inline parser in `table-decorations.ts` before Lezer's standard `Link` parser, so `[[...]]` no longer gets treated as a normal markdown reference link inside preview cells.
- Table-cell markdown links now carry `data-href`, and table-cell wiki links carry `data-wiki-target`.
- `linkNavigationExtension` now prefers `.cm-rendered-link[data-href]` before source-position lookup, which lets table widget links navigate and stops the table click-to-unfold handler from winning.
- `wikiLinkClickHandler` now prefers `.cm-wiki-link[data-wiki-target]` before source extraction, giving table widget wiki links the same resolver as ordinary wiki links.
- Added focused tests in `apps/desktop/tests/table-decorations.test.ts` for escaped-pipe wiki aliases and wiki links nested inside bold text.
- Validation:
  - `vp test apps/desktop/tests/table-decorations.test.ts` passed: 7 tests.
  - `vp check` passed with two existing E2E JS warnings.
  - `vp test` passed: 24 files, 400 tests.
  - `cargo fmt --check` passed.
  - `cargo test` passed: 103 Rust tests.
  - `cargo clippy` passed with existing warnings.
