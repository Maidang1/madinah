# Slash Markdown Insertions

## Goal

Make the editor slash menu a faster way to insert common Markdown syntax while reusing the current editor command pipeline.

## Scope

- Add slash-accessible insert commands for common Markdown snippets.
- Keep command execution in `editor-commands.ts` and text edits in `markdown-formatting.ts`.
- Preserve the existing slash trigger behavior: type `/`, filter commands, press Enter/Tab or click to run.
- Keep ArrowUp / ArrowDown navigation visible as the selected item moves through a scrollable menu.
- Keep inserted snippets focused at the editable placeholder.
- Keep the slash menu visible when CodeMirror cannot synchronously return caret DOM coordinates.
- Add focused tests for snippet insertion and slash search coverage.

## Markdown Snippets

- Image: `![alt](url)`
- Callout: `> [!note]`
- Math block: `$$`
- Footnote: `[^1]`
- HTML comment: `<!-- note -->`
- Frontmatter block: `---`

## Out Of Scope

- New markdown renderer capabilities.
- Plugin-provided slash commands.
- AI command placement changes.
- Full command registry refactor for native menus.

## Acceptance

- Slash search finds the new insert commands by label and keywords.
- Keyboard navigation scrolls the selected slash command into view.
- Running each snippet command inserts valid Markdown at the caret.
- The caret or selection lands on the primary editable placeholder.
- The slash menu positions from CodeMirror line geometry if `coordsAtPos` is unavailable.
- Existing context-menu insert actions still work.
- `vp test` and `vp check` pass for the desktop project.
