# Table Cell Link Regressions Spec

## Summary

Rendered links inside folded table preview cells should behave like links, not like clicks on the table widget. Markdown links should navigate through the existing editor link path, and Obsidian wiki links such as `[[Format your notes\|Formatting]]` should render as `Formatting` and navigate to `Format your notes`.

## Goals

- Clicking a markdown link inside a folded table preview navigates instead of unfolding the table source.
- Clicking a wiki link inside a folded table preview navigates through the same resolver as ordinary wiki links.
- Table-cell wiki links support Obsidian aliases, including table-escaped alias separators (`\|`).
- Keep inline HTML text-only inside table cells.

## Non-Goals

- Visual editing inside folded table cells.
- Rendering block markdown in table cells.
- Changing how clicking non-link table cells enters source-edit mode.

## Implementation Notes

- Link widgets inside table cells need source-derived payloads because `posAtCoords` inside a replaced table widget cannot reliably recover a `Link` syntax node.
- Standard table-cell links can reuse the existing `linkNavigationExtension` if it reads `data-href` before falling back to source-position lookup.
- Wiki table-cell links can reuse `wikiLinkClickHandler` if it reads `data-wiki-target` before falling back to source extraction.

## Acceptance Criteria

- Table-cell markdown links render with an inert DOM payload and navigate via the existing follow-link path.
- Table-cell wiki links render as `.cm-wiki-link` with the correct alias display text.
- Clicking table-cell links does not trigger the table widget's click-to-unfold behavior.
- Focused tests cover standard table-cell link payloads and escaped-pipe wiki aliases.
