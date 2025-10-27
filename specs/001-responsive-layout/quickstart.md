# Quickstart — Responsive Layout Refresh

## 1. Bootstrap
- Check out branch `001-responsive-layout`.
- Ensure dependencies are installed: `pnpm install`.
- Start Remix dev server for manual QA: `pnpm dev`.

## 2. Implementation Guardrails
- Update spacing + typography tokens in `app/styles/tailwind.css` and extend Tailwind config; reuse tokens across list/detail components.
- Refactor `app/features/blog/components/blog-list/list.tsx` to use the new responsive grid, shared spacing tokens, and the `usePrefersReducedMotion` hook.
- Adjust detail layout (`app/features/blog/components/blog-detail/*`) to apply the new rhythm, `usePrefersReducedMotion`, and data attributes used by tests.

## 3. Automated Tests
- Author Vitest suites beside the components (`list.responsive.test.tsx`, `list.accessibility.test.tsx`, `detail.layout.test.tsx`, `detail.accessibility.test.tsx`) that:
  - simulate 360 px/768 px/1280 px widths via `tests/utils/viewport.ts` and assert column counts + above-the-fold density,
  - verify line-length measurements stay within 60–90 characters,
  - confirm `prefers-reduced-motion` disables hover/entrance animations.
- Run `pnpm test` until green; keep snapshots readable.

## 4. Linting & Types
- Run `pnpm lint` and `pnpm typecheck` before committing.
- Resolve Tailwind class ordering or TypeScript errors immediately.

## 5. Performance & Accessibility
- Build production assets: `pnpm build`.
- From the `build/` output, run Lighthouse (mobile + desktop): `pnpm exec lighthouse http://127.0.0.1:8788/blog --view` after starting `pnpm start`.
- Capture keyboard navigation walkthroughs and contrast results; record findings under `specs/001-responsive-layout/checklists/requirements.md`.

## 6. Manual Verification
- Mobile: 360 px and 414 px emulators — ensure ≥4 cards above the fold, no horizontal scroll.
- Tablet: 834 px landscape — confirm spacing scales gracefully.
- Desktop: ≥1280 px — verify two-column density and sidebar alignment.
- Detail page: scroll a 2000-word article while observing media spacing and scroll performance (target 60 fps via DevTools performance panel).
