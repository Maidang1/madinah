# Repository Guidelines

## Project Structure & Module Organization
The Remix application lives in `app/`. Keep route modules in `app/routes/` (Remix naming such as `books_.$bookId.tsx`). Shared building blocks sit under `app/core/` — `core/ui/` for UI atoms, `core/utils/` for helpers, `core/hooks/` for cross-cutting state, `core/config/` for constants, and `core/mdx/` for MDX chrome. Feature code belongs in `app/features/<domain>/`, grouping each domain’s `components/`, `hooks/`, `data/`, and long-form `content/` (e.g. `app/features/books/content/`). Static files live in `app/assets/` and `public/`, automation in `app/scripts/`, and Cloudflare Pages functions in `functions/[[path]].ts`. Build artifacts land in `build/`; never edit them directly. Shared config resides in `tailwind.config.ts`, `postcss.config.js`, and `load-context.ts`.

## Build, Test, and Development Commands
Use `pnpm` throughout.
- `pnpm dev` – start the Remix dev server with HMR.
- `pnpm build` – produce the client/server bundles in `build/`.
- `pnpm start` – preview the production build via `wrangler`.
- `pnpm lint` – run ESLint (cached) using the repo `.eslintrc`.
- `pnpm typecheck` – run TypeScript in project references mode.
- `pnpm typegen` – refresh Cloudflare bindings before deploying.
- `pnpm deploy` – publish `build/client` to Cloudflare Pages.

## Coding Style & Naming Conventions
Code is TypeScript-first with 2-space indentation and trailing commas. Components and hooks follow `PascalCase`/`useCamelCase`, while route files keep Remix naming (`books_.$bookId.tsx`). Place cross-cutting hooks in `app/core/hooks/` and feature-scoped hooks with the rest of the feature. Tailwind CSS is the primary styling system; keep utility classes grouped by intent and rely on the Prettier Tailwind plugin for ordering. Run `pnpm lint` before opening a PR; it enforces ESLint + Prettier.

## Testing Guidelines
Automated tests are not yet in the tree; new features should ship with unit or integration coverage. We prefer Vitest colocated near the code (`*.test.ts[x]`). Document any manual verification steps in the PR and wire tests into `pnpm test` once added.

## Commit & Pull Request Guidelines
Follow the Conventional Commits pattern seen in history (`feat:`, `fix:`, `chore:`). Each PR should include a concise summary, link to the tracking issue, and screenshots or recordings when UI changes are visible. Highlight breaking changes or config updates in the description, and mention required follow-up tasks (migrations, cache invalidations).

## Active Technologies
- TypeScript 5.9 on Remix 2.17 (React 19) running in a Cloudflare Workers runtime + Remix router/rendering, Tailwind CSS 4.1, motion/react (animation), class-variance-authority + cn utility from `~/core/utils` (001-responsive-layout)
- File-backed MDX posts via `virtual:blog-list` (no database) (001-responsive-layout)

## Recent Changes
- 001-responsive-layout: Added TypeScript 5.9 on Remix 2.17 (React 19) running in a Cloudflare Workers runtime + Remix router/rendering, Tailwind CSS 4.1, motion/react (animation), class-variance-authority + cn utility from `~/core/utils`
