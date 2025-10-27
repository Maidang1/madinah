# Data Model — Responsive Layout Refresh

## Article (existing `PostInfo`)
- **Fields**
  - `title: string` — localized title surfaced in list cards and detail header.
  - `summary: string` — teaser paragraph; optional AI summary on detail page.
  - `tags: string[]` — small taxonomy badges; max 6 shown per card.
  - `time: string` — ISO publish timestamp used for chronological sort.
  - `date: string` — display-friendly date fallback when `time` is absent.
  - `readingTime: { minutes: number; words: number }` — reading aid displayed in header and sidebar.
  - `filename: string` — MDX slug for edit links.
  - `url: string` — Remix route path (e.g. `/blogs/prompt`).
  - `toc: TocItem[]` — heading outline powering table of contents widgets.
  - `status?: "WIP" | "ready"` — filters unfinished drafts from list view.
  - `author?: string` — surface-level attribution.
  - `content: string` — compiled MDX body (rendered in detail view).
- **Relationships**
  - Referenced by `BlogListPage` to render cards.
  - Referenced by `ArticleDetailPage` for hero metadata and MDX body.
- **Validation Rules**
  - `title`, `summary`, `url` must be non-empty.
  - `time` or `date` must parse to a valid `Date`; skip cards that fail.
  - `readingTime.minutes` clamps to ≥1 before display.
  - `toc.level` constrained to heading depth 2–4 to fit sidebar spacing.

## BlogListLayout
- **Fields**
  - `breakpoints: { mobile: 320-767; tablet: 768-1023; desktop: ≥1024 }`.
  - `columns: { mobile: 1; tablet: 1; desktop: 2 }` — optional 3rd column flagged off for this release.
  - `cardSpacing: { vertical: --space-stack-md; horizontal: --space-inline-md }`.
  - `cardPadding: { mobile: --space-inset-sm; desktop: --space-inset-md }`.
  - `aboveFoldTarget: 4` — minimum cards visible at 360 px viewport height.
  - `animation: { duration: 120ms; easing: var(--ease-standard); reduceMotionFallback: 'none' }`.
- **Relationships**
  - Consumes `Article` data to seed cards.
  - Shares token definitions with `PageContainer` primitive in `app/core/ui`.
- **Validation Rules**
  - Ensure horizontal overflow is hidden at all breakpoints.
  - `aboveFoldTarget` verified via automated snapshot test that simulates 360 px viewport.
  - Hover/focus states must keep accessible contrast (≥4.5:1).

## ArticleDetailLayout
- **Fields**
  - `readingMeasure: clamp(56ch, 70ch, 80ch)` — controls line length across breakpoints.
  - `verticalRhythm: { headingSpacing: --space-stack-lg; paragraphSpacing: --space-stack-md; mediaSpacing: --space-stack-lg }`.
  - `sidebar: { width: 18rem; stickyOffset: 112px; maxHeight: calc(100vh - 7rem) }`.
  - `tocCollapseBreakpoint: 1280px` — mobile Drawer vs. desktop sidebar.
  - `heroSpacing: { title: --space-stack-md; metadata: --space-stack-sm }`.
  - `scrollRestoration: true` — uses Remix `ScrollRestoration` component.
- **Relationships**
  - Renders `Article` metadata plus MDX content through `MDXWrapper`.
  - Shares spacing tokens with BlogListLayout for consistency.
- **Validation Rules**
  - Running text must produce 60–90 characters per line in automated tests.
  - Sidebar TOC scroll area must retain keyboard focus order.
  - Media blocks keep caption and image within the same spacing stack.

## LayoutTokenSet
- **Fields**
  - `--space-stack-sm|md|lg`: numeric rem values for vertical rhythm.
  - `--space-inline-sm|md`: horizontal padding scale.
  - `--font-size-body`, `--line-height-body`, `--font-size-heading-lg`: typography scale updates.
  - `--ease-standard`, `--transition-fast`: animation variables capped at 150 ms.
- **Relationships**
  - Injected into `:root` via `app/styles/tailwind.css`, consumed through Tailwind utilities (`[--space-stack-md]`, custom classes).
  - Referenced by both layout components and MDX wrappers.
- **Validation Rules**
  - Tokens must meet WCAG contrast in both light/dark themes.
  - Documented in `quickstart.md` with guidance for reuse.
  - Modifications require updating Tailwind safelist if custom properties used in arbitrary values.
