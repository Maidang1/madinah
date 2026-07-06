# Madinah Article Render Parity

## Goal

Make the desktop editor's writing surface match the Madinah Astro article detail page closely enough that drafting locally gives the same typography, spacing, color, and block treatment as the online post view.

Reference implementation:

- Astro article page: `/Users/bytedance/codes/myself/madinah/src/pages/blog/[...slug].astro`
- Astro layout/font loading: `/Users/bytedance/codes/myself/madinah/src/layouts/BaseLayout.astro`
- Astro reader styles: `/Users/bytedance/codes/myself/madinah/src/styles/global.css`

## Scope

This first slice owns the render contract inside the current Tauri fork:

- Add Madinah reader tokens to the desktop app stylesheet.
- Make ProseMark/CodeMirror editor typography use the same reader font, width, color, paragraph rhythm, heading sizes, list rhythm, quote border, inline code, code block, table, and image treatment as the Astro article content.
- Keep the surrounding Writer chrome and file workflow intact.
- Preserve the existing editor settings path, including the width mode and font-size settings where they still make sense.

## Out Of Scope

- AI polish migration from `/Users/bytedance/codes/myself/madinah/apps/writer`
- Cloudflare/R2 image upload migration
- Slash command migration
- Full MDX component preview parity
- Astro-side code changes

## Constraints

- Use the Astro reader style values as the source of truth for this slice.
- Keep changes CSS-first unless a block cannot be represented in CSS.
- Keep the current fork's Tauri shell as the product surface.
- Keep the current Tauri app architecture, CodeMirror/ProseMark editor, and settings store.

## Acceptance

- A normal Markdown document opened in the desktop editor uses the same `reader-*` typography and colors as the Astro post page.
- The desktop text column width matches the Astro post content width target.
- Headings, paragraphs, lists, blockquotes, inline code, fenced code, images, and folded table previews visually follow the Astro post content rules.
- Tests cover the CSS contract for the reader variables and critical selector values.
- Baseline validation is recorded in the agent worksheet.

## Follow-up Tasks

- Migrate AI polish capabilities through the current Tauri command/context-menu architecture.
- Migrate pasted-image upload to the Madinah Cloudflare asset target.
- Reintroduce slash commands as a focused command surface, grounded in the current editor command registry.
