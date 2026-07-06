# MDX File Rendering Support

## Goal

Support `.mdx` files as first-class Writer documents.

## Scope

- Open `.mdx` files from Finder, CLI, file picker, drag/drop, workspace sidebar, and internal navigation.
- Include `.mdx` files in workspace indexing, search, recent files, pinned files, and directory reads.
- Watch `.mdx` create/delete/update events the same way as `.md` files.
- Resolve explicit `.mdx` Markdown links and extensionless links that point to `.mdx` files.
- Resolve wiki links to `.mdx` files when no `.md` file exists.
- Render `.mdx` content with the current safe Markdown/HTML rendering path.

## Non-goals

- Execute MDX JSX components.
- Add workspace-trusted MDX plugins.
- Change the default new-file extension from `.md`.

## Acceptance Criteria

- `.mdx` appears in the sidebar and search index.
- Opening a `.mdx` file uses the same editor and renderer as Markdown files.
- Extensionless Markdown and wiki links can navigate to `.mdx`.
- Rust and frontend tests cover the new extension.
- Validation passes for desktop TypeScript and Rust.
