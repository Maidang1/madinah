# Phase 0 Research — Responsive Layout Refresh

Decision: Define reusable typography and spacing tokens as CSS custom properties in `app/styles/tailwind.css`, exposing them through Tailwind theme extensions for line length (`maxWidth`), line-height, and vertical rhythm.  
Rationale: Centralizing the new rhythm in Tailwind keeps list/detail pages consistent and allows Remix routes to share tokens via utility classes and `@apply`; CSS variables also make dark/light adjustments trivial.  
Alternatives considered: Hard-code sizes within each component (risks drift and duplication), adopt a third-party typography plugin (introduces dependency review overhead and less control).

Decision: Rebuild the blog list layout as a Tailwind grid with clamp-based gutters (1fr columns on mobile, two equal columns ≥1024 px) and use density utilities (`gap-y-6`, `p-4`) tuned to the new tokens.  
Rationale: Tailwind grid utilities integrate cleanly with Remix components and keep responsive behavior declarative; clamp gutters help satisfy “four above the fold” without over-tightening desktop spacing.  
Alternatives considered: Flexbox with wrap (less predictable column heights, harder to balance gaps), CSS masonry (inconsistent support and unnecessary for uniform cards).

Decision: Constrain article detail content to ~72ch width using tailwind `max-w-[--reading-measure]` plus new spacing tokens, and leverage `MDXWrapper` to apply the rhythm; keep supporting media grouped via consistent margin stacks.  
Rationale: Character-based widths meet the 60–90 character guideline across breakpoints, and wrapping adjustments in the MDX wrapper keeps Remix route content lean.  
Alternatives considered: Tailwind `prose` classes (would override much of the existing styling and conflict with custom MDX styles), leaving current max-width (too wide on desktop, inconsistent mobile spacing).

Decision: Replace most `motion/react` animations with Tailwind transition utilities and CSS `@media (prefers-reduced-motion: reduce)` guards, retaining only lightweight fade-ins where necessary and capping durations at 150 ms.  
Rationale: CSS transitions are cheaper than runtime animations, simplify respecting reduced-motion preferences, and align with the spec’s “minimal animation” requirement while still signaling interactivity.  
Alternatives considered: Keep existing Motion variants (violates performance + animation constraints), drop all transitions (hurts perceived polish).

Decision: Author Vitest + Testing Library regression tests that render the Remix list/detail components under different viewport widths using `window.resizeTo` helpers, capturing DOM assertions for column counts, line length, and reduced-motion behavior; complement with `pnpm exec lighthouse` runs after `pnpm build` to log LCP/INP/CLS.  
Rationale: Vitest matches the repo’s tooling and supports jsdom layout assertions; Lighthouse on production builds is the lowest-friction way to verify Core Web Vitals budgets in a Cloudflare-compatible pipeline.  
Alternatives considered: Playwright e2e (heavier to maintain for this scope), relying only on manual QA (conflicts with constitution principle II & NFR-004).
