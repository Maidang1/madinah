# Frontmatter Properties Sidebar

## Problem

The editor currently renders frontmatter fields at the top of the document body. That makes blog metadata look like article content and pushes the first real heading down the page.

## Goal

Move frontmatter editing into a document-level right-side properties inspector. The editor body should start with the Markdown content, while metadata remains editable through an explicit side surface.

## Requirements

- The properties inspector is collapsed by default.
- A visible icon button opens and closes the inspector for the active document.
- The command palette exposes a Show/Hide Properties command when a file is active.
- Switching files closes the inspector.
- The inspector edits the same frontmatter data as the existing panel and writes through the existing frontmatter update path.
- Documents without frontmatter can create the first property from the inspector.
- AI metadata generation continues to merge into the same frontmatter source.
- AI Review remains a separate floating panel above the properties inspector.
- Known Madinah frontmatter fields use typed controls: `status` is a select enum,
  `pubDate` is a date-time input, `tags` edits a YAML list, and `description`
  uses a multiline field. Unknown keys remain plain text fields.

## Validation

- `EditorPane` no longer renders frontmatter fields inside the document scroll body.
- Properties open from the icon button and command palette.
- Editing, adding, and removing properties still updates frontmatter and dirty state.
- Typed controls preserve YAML semantics, especially `tags` as a list and `status`
  as a scalar enum value.
- Run `vp check` and `vp test`.
