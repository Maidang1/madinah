# Worksheet: Properties Inspector Visual Polish

## Task

- TODO: `Properties inspector visual polish`
- Spec: [`../properties-inspector-polish-spec.md`](../properties-inspector-polish-spec.md)

## Reviewed

- `AGENTS.md`, `docs/workflows/agent-loop.md`, `docs/workflows/agent-review.md`
- `docs/react-guidelines.md`
- Existing frontmatter sidebar spec and worksheet
- `src/components/editor-area/document-inspector.tsx`
- `src/components/editor-area/frontmatter-panel.tsx`
- `src/components/overlay-scrollbar.tsx`
- `src/lib/frontmatter-schema.ts` and focused frontmatter tests
- Shared floating-card styles in `src/App.css`

The working tree was clean before task documents were added. Baseline `vp check` passed, and the
frontmatter schema plus YAML entry suites passed (2 files / 21 tests).

## Plan

1. Reuse the shared `surface-card` visual treatment and replace the full-height aside with a
   right-aligned, content-sized, non-modal card. Size it with a pane-relative maximum width and safe
   insets instead of a window breakpoint; use a component container query only to stack compact rows
   when the inspector itself becomes too narrow.
2. Make header, bounded rows-only scroll body, and Add property footer explicit siblings. Handle the
   no-frontmatter create action through the same fixed footer.
3. Add control-level surfaces and focus feedback. Use a three-column grid for short values and a
   stacked grid for textarea fields so long descriptions get the full width.
4. Improve the existing interaction semantics without adding state: expose expanded/controls and
   labelled-by relationships, focus the close control on mount, restore focus to the trigger for
   inspector-owned close paths, keep remove controls tabbable and visible, and give every control a
   property-specific accessible name. The card remains non-modal, so the editor stays interactive.
5. Validate with `vp check`, full `vp test`, focused tests, and scripted local-browser interaction.
   Cover no/few/many properties; regular, narrow-pane, narrow-window, and short-height geometry;
   rows-only scrolling with a fixed header/footer; Tab/Shift-Tab, Escape/focus return, create/add/
   edit/remove, every typed control, View online/status, and Publish absence. No component unit test
   is added because the test environment is Node-only; scripted rendered interaction covers the DOM
   contract while existing tests cover YAML/schema/store/publication behavior.

## Risks

- Native `datetime-local` rendering has a wider intrinsic size than text inputs; the grid and input
  need explicit `min-width: 0` behavior.
- Content-sized flex containers can accidentally expand to their max height; browser verification
  must confirm that small property sets do not recreate the empty drawer.
- The narrow layout still needs enough height for long metadata while keeping its header reachable.
- Native `datetime-local` rendering must also be inspected in the Tauri WKWebView after browser QA
  when the desktop runtime is available.

## Plan Review

- React/Frontend: requested explicit scroll ownership, pane-relative sizing, and interaction QA.
- UX: requested fixed footer, keyboard/touch-safe removal, focus lifecycle, and specific accessible
  labels. The modal concern is resolved by making the inspector explicitly non-modal with no backdrop.
- QA: requested full tests plus a content-volume, viewport, keyboard, and control interaction matrix.
- All blocking findings are incorporated into the plan above before implementation.

## Results

- Replaced the full-height drawer with the shared floating-card surface, sized and inset relative to
  the editor pane. Small property sets now keep a content-sized card; overflowing fields scroll
  between a fixed header and fixed Add property footer.
- Added a pane-local container layout: short fields use compact key/value/remove columns at full card
  width, while descriptions and cards at or below 340px stack controls to preserve usable width.
- Added visible input surfaces and focus treatments, property-specific accessible labels, a tabbable
  removal affordance, disclosure semantics on both open and hide controls, deterministic initial and
  return focus, row-exit placeholder cleanup, and next/previous/Add focus continuation after removal.
- Preserved typed frontmatter conversion, create/update/remove behavior, View online/status display,
  file-switch/Escape dismissal, and the absence of Publish actions.

### Validation

- `corepack pnpm exec vp check` — passed (285 formatted files, 169 lint/typechecked files).
- `corepack pnpm exec vp test` — passed (29 files / 318 tests).
- Focused frontmatter schema and YAML entries — passed (2 files / 21 tests).
- `corepack pnpm exec vp build` — passed; the existing large-chunk advisory remains unchanged.
- `corepack pnpm run dev` — Tauri development build compiled and launched successfully with the
  repository's existing Rust dead-code warnings.
- Automated browser and Computer Use targets were unavailable in this session. The user manually
  verified the rendered Properties UI and approved committing the local code.

### Implementation Review

- React/Frontend and UX follow-up reviews gave a green light with no remaining P0/P1/P2 findings;
  QA found no P0/P1 findings. Their focus visibility, empty-frontmatter
  focus arbitration, row-exit cleanup, disclosure semantics, date-width breakpoint, post-removal
  focus continuity, and completion-documentation findings were addressed before final validation.
