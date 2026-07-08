# Madinah Content System Convergence

## Goal

Converge the Astro blog and Writer desktop app onto shared content packages so blog metadata, rendering, publishing, and AI planning follow one set of rules.

## Confirmed Decisions

- Writer publishes to the local Madinah repository directory.
- Published blog files are written under `src/blogs`.
- The user keeps the current file name. The file path without extension is the URL identity.
- `slug` remains a metadata field for SEO and display use.
- Draft editing can keep local temporary image references.
- Publishing uploads images and replaces body references with absolute CDN URLs.
- Publishing is blocked when validation fails.
- Blog detail pages and Writer preview use the same Markdown rendering package.
- CodeMirror decorations keep the editing experience fast and stable while visually tracking the final rendering as closely as practical.
- Each `packages/*` package has a public API boundary, README, and tests.

## Target Packages

### `@madinah/content-core`

Owns content data rules:

- Blog post status options and predicates.
- Supported blog file extensions.
- File path to route identity helpers.
- Frontmatter parse and serialize.
- Document title inference.
- Frontmatter display dates.
- Reading-time calculation.

### `@madinah/markdown-core`

Owns render consistency:

- Shared Markdown/MDX rendering entry.
- Heading slug behavior.
- MDX component mapping.
- Link and image resolution rules.
- Shared table, code, image, and callout behavior for preview and site detail.

### `@madinah/publish-core`

Owns write-time publishing rules:

- Generate or normalize frontmatter.
- Plan image uploads.
- Replace local image references with CDN URLs.
- Validate the complete publish plan before writing.
- Produce a write plan for `src/blogs`.

### `@madinah/ai-core`

Owns structured AI outputs:

- Polish body text.
- Suggest frontmatter.
- Build a full publish plan.
- Review publishing readiness.
- Validate AI output schemas before Writer applies results.

## Phase 1 Acceptance Criteria

- Astro and Writer consume frontmatter/status helpers from `@madinah/content-core`.
- Astro and Writer consume reading-time and document parsing helpers from `@madinah/content-core` where applicable.
- Legacy local modules only re-export shared content APIs.
- `@madinah/content-core` has package-local tests.
- Existing Writer tests pass.
- Astro build passes.

## Later Acceptance Criteria

- Writer preview and blog detail page share `@madinah/markdown-core`.
- Publishing side effects are isolated behind `@madinah/publish-core`.
- AI actions emit schema-validated `@madinah/ai-core` results before mutating editor state or writing files.
