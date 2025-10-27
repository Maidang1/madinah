# Implementation Plan: Responsive Layout Refresh

**Branch**: `001-responsive-layout` | **Date**: 2025-10-27 | **Spec**: [/specs/001-responsive-layout/spec.md](/specs/001-responsive-layout/spec.md)
**Input**: Feature specification from `/specs/001-responsive-layout/spec.md`

## Summary

Refresh the blog list and detail layouts to be responsive across mobile, tablet, and desktop, delivering denser list cards on small screens, multi-column density on desktop, and refreshed typography/spacing for article detail readability. The implementation will lean on Tailwind-driven responsive utilities, trim Motion animations to subtle feedback respecting reduced-motion preferences, and update shared layout tokens or components so both list and detail routes adopt the new rhythm without introducing layout jank.

## Technical Context

**Language/Version**: TypeScript 5.9 on Remix 2.17 (React 19) running in a Cloudflare Workers runtime  
**Primary Dependencies**: Remix router/rendering, Tailwind CSS 4.1, motion/react (animation), class-variance-authority + cn utility from `~/core/utils`  
**Storage**: File-backed MDX posts via `virtual:blog-list` (no database)  
**Testing**: Vitest + @testing-library/react with jsdom environment  
**Target Platform**: Cloudflare Pages/Workers edge; user agents include modern mobile and desktop browsers  
**Project Type**: Web application (single Remix app under `app/`)  
**Performance Goals**: LCP ≤ 2.5s, INP ≤ 200ms, CLS < 0.1, sustained 60fps scroll on list/detail routes (per spec)  
**Constraints**: Must maintain WCAG 2.1 AA (keyboard, contrast, ARIA), at least four mobile-above-fold list items and two desktop columns, subtle transitions ≤150 ms honoring prefers-reduced-motion, CLS budget 0.1, updated spacing/typography tokens defined in Phase 0 research  
**Scale/Scope**: Single blog property with dozens of MDX posts; updates scoped to list (`/blog`) and detail (`/blogs/*.mdx`) experiences

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] `pnpm lint`, `pnpm typecheck`, and format-on-save remain required; plan reuses existing Tailwind tokens where possible and avoids new dependencies, documenting any shared component updates in `/app/core/ui` if touched.
- [x] Author Vitest + Testing Library tests first for list (ensuring responsive column and truncation behavior) and detail (typography rules, reduced motion), asserting failure snapshots/layout expectations before implementation.
- [x] Reuse shared layout primitives (`app/core/ui/layout`) and document accessibility checks: keyboard navigation paths, contrast audits, and responsive screenshots at 360 px, 768 px, 1280 px; capture recordings for reviewer reference.
- [x] Measure performance budgets after `pnpm build` using Lighthouse CLI (mobile + desktop) and Chrome DevTools profiling; log LCP, INP, CLS, and scroll FPS in plan notes with follow-up tasks if mitigations needed.

**Post-Phase 1 Gate Review (2025-10-27)**: Research + design artifacts confirm no constitution violations; proceeding to Phase 2 planning is approved.

## Project Structure

### Documentation (this feature)

```text
specs/001-responsive-layout/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
```

### Source Code (repository root)

```text
app/
├── routes/
│   ├── _index.tsx
│   ├── blog.tsx              # list page wrapper
│   └── blogs.*.mdx           # article detail routes (generated from MDX)
├── features/
│   └── blog/
│       ├── components/
│       │   ├── blog-list/    # list layout & menu components
│       │   └── blog-detail/  # detail header, TOC, navigation
│       ├── data/blogs-summary.json
│       └── hooks/...
├── core/
│   ├── ui/                   # shared layout + primitives
│   ├── utils/                # cn utility, helpers
│   └── config/...
public/
└── styles via Tailwind tokens (tailwind.config.ts)

tests/
└── (Vitest setup in test-setup.ts; new specs to live near feature components)
```

**Structure Decision**: Extend existing Remix single-app layout; enhancements stay within `app/features/blog/components`, with shared spacing/typography tokens centralized in `app/core/ui` or Tailwind config to keep reuse across routes.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| _None_ | | |
