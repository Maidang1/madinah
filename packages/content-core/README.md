# @madinah/content-core

Shared content primitives for the Madinah blog and Writer desktop app.

## Public API

- Blog post status constants and predicates.
- Blog file identity helpers.
- Markdown frontmatter parse and serialize helpers.
- Document title inference.
- Frontmatter display date formatting.
- Reading-time calculation.

## Boundary

This package owns content data rules. Runtime-specific behavior such as Astro rendering, Tauri file writes, image uploads, and AI execution belongs in higher-level packages or apps.
