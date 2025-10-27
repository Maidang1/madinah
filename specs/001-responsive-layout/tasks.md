# Tasks: Responsive Layout Refresh

**Input**: Design documents from `/specs/001-responsive-layout/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Automated tests are MANDATORY. Each story lists the Vitest coverage that MUST be authored (and fail) before implementation, aligned with the constitution.

**Organization**: Tasks are grouped by user story so each slice can be implemented, tested, and delivered independently.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the workspace and evidence log for this feature.

- [X] T001 Sync workspace dependencies with `pnpm install` in package.json
- [X] T002 Seed accessibility and performance evidence sections in specs/001-responsive-layout/checklists/requirements.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared tokens and tooling used by every story. No user story work may begin until these tasks are complete.

- [X] T003 Define responsive spacing and typography CSS variables in app/styles/tailwind.css
- [X] T004 Extend Tailwind theme to expose new tokens and safelist custom properties in tailwind.config.ts
- [X] T005 [P] Create viewport resize test helper in tests/utils/viewport.ts and register import in test-setup.ts
- [X] T006 Add usePrefersReducedMotion hook for shared consumption in app/core/hooks/use-prefers-reduced-motion.ts

---

## Phase 3: User Story 1 – Mobile visitor scans article list (Priority: P1) 🎯 MVP

**Goal**: Deliver a compact, legible mobile article list that surfaces ≥4 cards above the fold without horizontal scrolling.

**Independent Test**: Serve `/blog` at 360 px width from production assets, verify automated layout regression, manual WCAG keyboard/contrast checks, and capture mobile Core Web Vitals (LCP, INP).

### Tests for User Story 1 (write first, ensure red state)

- [X] T007 [US1] Add failing 360 px density Vitest in app/features/blog/components/blog-list/list.responsive.test.tsx
- [X] T008 [P] [US1] Add failing prefers-reduced-motion coverage for list interactions in app/features/blog/components/blog-list/list.accessibility.test.tsx

### Implementation for User Story 1

- [X] T009 [US1] Refactor blog list grid for mobile density using new tokens in app/features/blog/components/blog-list/list.tsx
- [X] T010 [US1] Replace motion/react animations with Tailwind transitions honoring usePrefersReducedMotion in app/features/blog/components/blog-list/list.tsx
- [ ] T011 [US1] Document mobile WCAG + Lighthouse evidence for `/blog` in specs/001-responsive-layout/checklists/requirements.md

**Checkpoint**: `/blog` passes mobile layout, accessibility, and performance requirements independently.

---

## Phase 4: User Story 2 – Desktop reader compares multiple articles (Priority: P2)

**Goal**: Present a dense two-column desktop layout with balanced white space and accessible focus/hover states.

**Independent Test**: Render `/blog` at ≥1280 px from production assets, validate automated column snapshot, ensure keyboard navigation order, run Lighthouse desktop metrics to confirm Core Web Vitals budgets.

### Tests for User Story 2 (write first, ensure red state)

- [X] T012 [US2] Add failing ≥2 column desktop Vitest in app/features/blog/components/blog-list/list.responsive.test.tsx
- [X] T013 [P] [US2] Add failing keyboard navigation & focus regression test in app/features/blog/components/blog-list/list.accessibility.test.tsx

### Implementation for User Story 2

- [X] T014 [US2] Implement desktop two-column grid with balanced gutters in app/features/blog/components/blog-list/list.tsx
- [X] T015 [US2] Standardize desktop card height and focus-visible styling with new tokens in app/features/blog/components/blog-list/list.tsx
- [ ] T016 [US2] Document desktop WCAG + Lighthouse evidence for `/blog` ≥1280 px in specs/001-responsive-layout/checklists/requirements.md

**Checkpoint**: `/blog` meets desktop density, accessibility, and performance requirements independently.

---

## Phase 5: User Story 3 – Reader consumes article detail comfortably (Priority: P3)

**Goal**: Deliver an article detail layout with 60–90 character line length, consistent vertical rhythm, and reduced-motion friendly interactions.

**Independent Test**: Serve `/blogs/:slug` at 375 px and 1440 px using production assets, verify typography-focused automated tests, manual WCAG hierarchy/contrast, and scroll performance profiling.

### Tests for User Story 3 (write first, ensure red state)

- [X] T017 [US3] Add failing typography measure Vitest in app/features/blog/components/blog-detail/detail.layout.test.tsx
- [X] T018 [P] [US3] Add failing prefers-reduced-motion coverage for sticky header & TOC in app/features/blog/components/blog-detail/detail.accessibility.test.tsx

### Implementation for User Story 3

- [X] T019 [US3] Apply reading-measure tokens in app/core/mdx/mdx-wrapper.tsx and app/styles/mdx.css
- [X] T020 [US3] Update detail layout components to use new spacing and usePrefersReducedMotion in app/features/blog/components/blog-detail/detail.tsx and app/features/blog/components/blog-detail/detail-header.tsx
- [ ] T021 [US3] Document detail page WCAG + Lighthouse evidence for `/blogs/:slug` in specs/001-responsive-layout/checklists/requirements.md

**Checkpoint**: `/blogs/:slug` satisfies readability, accessibility, and performance criteria independently.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate shared quality gates and capture final documentation updates.

- [ ] T022 Run `pnpm lint` to ensure repository passes ESLint in package.json
- [ ] T023 Run `pnpm typecheck` against tsconfig.json
- [X] T024 Run `pnpm test` to confirm Vitest coverage passes in package.json
- [ ] T025 Run `pnpm build` and sanity-check build/ output for layout jank
- [X] T026 Update specs/001-responsive-layout/quickstart.md with final tooling and verification steps from implementation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 → Phase 2**: Complete setup before modifying shared tooling.
- **Phase 2 → User Stories**: All user story work depends on foundational tokens/hooks/tests being available.
- **User Stories**: Can proceed in priority order (US1 → US2 → US3) or in parallel once Phase 2 is complete, provided shared files are coordinated.
- **Polish**: Runs after desired user stories are complete.

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2 artifacts; forms the MVP slice.
- **US2 (P2)**: Builds on Phase 2 and may reuse utilities created during US1 but remains independently testable.
- **US3 (P3)**: Depends on Phase 2 and the shared hook; does not require US1/US2 completion to validate detail page.

### Within Each User Story

1. Author failing Vitest coverage (tasks T007–T008, T012–T013, T017–T018).
2. Implement component updates (tasks T009–T010, T014–T015, T019–T020).
3. Capture accessibility + performance evidence (tasks T011, T016, T021).
4. Verify checkpoint before moving on.

---

## Parallel Execution Examples

- **User Story 1**: T007 and T008 operate on separate test files and can be written concurrently once Phase 2 is complete.
- **User Story 2**: After T012 is drafted, T013 can run in parallel to extend the accessibility test suite; T014 and T015 should remain sequential due to shared file edits.
- **User Story 3**: T017 and T018 target different test files; they may be authored in parallel before implementation work begins.
- **Cross-Story**: Documentation tasks T011, T016, and T021 touch the same checklist file; schedule them sequentially to avoid merge conflicts.

---

## Implementation Strategy

### MVP First

1. Finish Phases 1–2 to establish tokens, helpers, and hooks.
2. Deliver Phase 3 (US1) end-to-end, ensuring `/blog` meets mobile requirements.
3. Validate tests, accessibility notes, and performance metrics before proceeding.

### Incremental Delivery

1. Ship US1 as the MVP mobile experience.
2. Layer in US2 for desktop density once US1 is stable.
3. Complete US3 to refresh detail readability, each with independent validation.

### Parallel Team Approach

1. Pair on Phase 2 foundations.
2. Assign US1 to Developer A (mobile list), US2 to Developer B (desktop tweaks), US3 to Developer C (detail readability).
3. Rejoin for Phase 6 polish to run lint/typecheck/test/build and finalize documentation.
