<!--
Sync Impact Report
- Version change: 0.0.0 (template) → 1.0.0
- Modified principles:
  - PRINCIPLE_1 placeholder → I. Production-Ready Code Quality
  - PRINCIPLE_2 placeholder → II. Tests Define the Contract
  - PRINCIPLE_3 placeholder → III. Consistent User Experience
  - PRINCIPLE_4 placeholder → IV. Performance at the Edge
- Added sections: Quality Gate Standards, Delivery Workflow
- Removed sections: PRINCIPLE_5 placeholder
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
- Follow-up TODOs: None
-->

# Madinah's Blog Constitution

## Core Principles

### I. Production-Ready Code Quality
- We MUST keep the TypeScript codebase lint- and format-clean by running `pnpm lint` (including Tailwind ordering) before requesting review.
- Every pull request MUST document its scope, update dependent docs or configs, and pass peer review that rejects unclear logic, duplication, or dead code.
- New dependencies MUST undergo security and licensing scrutiny; prefer existing utilities or core abstractions when they satisfy the need.
Rationale: Clear, production-grade code protects maintainability and accelerates sustainable delivery for the blog.

### II. Tests Define the Contract
- Each change MUST ship with automated coverage (Vitest unit, integration, or end-to-end) that exercises the new behavior; manual checks require an accompanying TODO to automate.
- Tests MUST lead implementation: author the failing test, confirm the red state, then implement changes and rerun `pnpm test`, `pnpm lint`, and `pnpm typecheck` until green.
- Regression fixes MUST include a test that fails before the fix to prevent recurrence.
Rationale: Test-first discipline documents system expectations and enables fearless iteration.

### III. Consistent User Experience
- UI changes MUST reuse shared building blocks from `app/core/ui/` and follow Tailwind intent grouping so layouts remain responsive across breakpoints.
- Every user-facing change MUST achieve WCAG 2.1 AA: keyboard navigation, ARIA labeling, and contrast checks are performed before approval.
- Content updates MUST preserve the blog's voice and include cross-device verification (desktop + mobile) via `pnpm dev` previews or captured recordings.
Rationale: Consistency builds reader trust and keeps the blog inclusive.

### IV. Performance at the Edge
- Page loads and critical interactions MUST stay within Core Web Vitals budgets: Largest Contentful Paint ≤ 2.5s and Interaction to Next Paint ≤ 200ms on fast 3G using production builds.
- Loaders and actions MUST minimize blocking I/O; prefer caching, incremental rendering, and streaming strategies where Remix supports them.
- Each feature MUST document how performance is measured (metrics, tooling, and sampling plan) in its spec or plan, and reviewers MUST block regressions without an approved mitigation.
Rationale: Fast experiences retain readers, bolster SEO, and respect Cloudflare edge constraints.

## Quality Gate Standards
- Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` locally before review; failing gates MUST be resolved prior to opening or merging a PR.
- Record performance metrics, accessibility evidence, and screenshots in feature specs or PR descriptions to demonstrate compliance with Core Principles III and IV.
- Capture manual QA notes only as a temporary bridge, with linked TODOs or issues tracking the automation backlog.
- Production releases MUST originate from a successful `pnpm build` and include a smoke validation via `pnpm start` or Cloudflare preview before publish.

## Delivery Workflow
- Feature specifications MUST enumerate automated tests, accessibility checks, and performance budgets for each user story, keeping them independently deliverable.
- Implementation plans MUST confirm the Constitution Check gates (quality, testing, UX, performance) before any Phase 0 work proceeds.
- Task breakouts MUST pair implementation with corresponding test, accessibility, and performance verification tasks; no story closes until all checks pass.
- Reviewers MUST document constitution compliance in PR approvals and create follow-up tasks if mitigation timelines are agreed.

## Governance
- Amendments require a pull request that explains the rationale, expected impact, and any migration tasks; at least one maintainer approval is mandatory.
- Versioning follows semantic rules: MAJOR for principle removals or incompatible rewrites, MINOR for new principles or expanded obligations, PATCH for clarifications that do not change expectations.
- Compliance is reviewed quarterly and before major releases; maintainers audit recent specs, plans, and task lists, filing issues for any deviations and tracking remediation.

**Version**: 1.0.0 | **Ratified**: 2025-10-24 | **Last Amended**: 2025-10-24
