# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is Madinah's personal blog built with **Remix** (React-based full-stack framework), deployed on **Cloudflare Pages**. The site features:
- Blog posts written in MDX
- Book/chapter content system
- Multi-language support (i18n)
- Theme switching (light/dark/system)
- Interactive features (Excalidraw diagrams, animations)

## Common Commands

```bash
# Development
pnpm dev                    # Start Remix dev server with HMR
pnpm build                  # Build client/server bundles to build/
pnpm start                  # Preview production build via wrangler

# Code Quality
pnpm lint                   # Run ESLint (cached)
pnpm typecheck              # Run TypeScript compiler
pnpm typegen                # Generate Cloudflare bindings types

# Testing
pnpm test                   # Run all tests with Vitest
pnpm test:watch             # Run tests in watch mode

# Deployment
pnpm deploy                 # Deploy build/client to Cloudflare Pages
```

**Package Manager**: Uses `pnpm` exclusively.

**Test Runner**: Vitest with `@testing-library/react`. Test files colocated as `*.test.ts[x]`.

## Architecture Overview

### Directory Structure

```
app/
├── routes/                     # Remix route modules (file-based routing)
├── core/                       # Shared building blocks
│   ├── ui/                     # UI components (atoms, layout, magic effects)
│   ├── utils/                  # Helper functions
│   ├── config/                 # Constants & configuration
│   ├── hooks/                  # Cross-cutting state/hooks
│   ├── mdx/                    # MDX processing components
│   └── i18n/                   # Internationalization
├── features/                   # Feature-based modules
│   ├── blog/                   # Blog feature (list, detail, TOC)
│   └── books/                  # Book feature (chapters, sidebar)
├── types/                      # TypeScript type definitions
├── styles/                     # Global CSS files
├── entry.client.tsx            # Client-side hydration
├── entry.server.tsx            # Server-side rendering
└── root.tsx                    # App shell & providers

utils/                          # Build-time utilities
├── post.ts                     # Blog post metadata generation
├── book.ts                     # Book content processing
├── rss.ts                      # RSS feed generation
└── toc.ts                      # Table of contents generation

functions/                      # Cloudflare Pages functions
└── [[path]].ts                 # Request handler for Pages

public/                         # Static assets
build/                          # Build artifacts (generated)
```

### Key Technologies

- **Remix v2** with Vite plugin (`@remix-run/cloudflare-pages`)
- **React 19** with server-side rendering
- **MDX** for content (enhanced with Shiki Twoslash for code blocks)
- **Tailwind CSS 4** with custom theme colors
- **Cloudflare Pages** for deployment
- **Vitest** for testing
- **TypeScript** (strict mode, ES2022 target)

### Route Organization

Remix uses **file-based routing** with nested routes using `.` separator:
- `routes/_index.tsx` → `/`
- `routes/blogs/index.tsx` → `/blogs`
- `routes/books.$bookId._index.tsx` → `/books/:bookId`
- `routes/books.$bookId.$chapterId.tsx` → `/books/:bookId/:chapterId`
- `routes/[rss.xml].tsx` → `/rss.xml`

Dynamic parameters use `$` prefix (e.g., `$bookId`, `$chapterId`).

### MDX Content System

**Blogs**: Auto-generated metadata via `virtual:blog-list` in `vite.config.ts:96-99`
- Scans `app/routes/blogs.*.mdx` files
- Extracts frontmatter (title, date, summary, tags)
- Used in blog listing pages

**Books**: Virtual module via `booksVirtualPlugin()` in `vite.config.ts:14,94`
- Stored in `app/features/books/content/`
- Example: `rust-async-guide/book.mdx` + chapters
- Processed at build time, imported dynamically in routes

**MDX Features**:
- Shiki Twoslash syntax highlighting
- Custom code blocks with enhanced styling
- Excalidraw diagram support (`.excalidraw` files)
- Table of contents auto-generation
- Custom MDX components via `MDXProvider` in `app/core/mdx/`

### Styling Architecture

Three-layer system:
1. **Tailwind CSS** - Utility-first framework
2. **CSS Modules/LESS** - Component-specific styles (`app/styles/theme.less`)
3. **MDX Components** - Customized content rendering (`app/core/mdx/components/`)

Theme variables defined in `tailwind.config.ts` with `main` brand color.

### State Management

- **Jotai** - Atomic state management for React
- **React hooks** - Local component state
- **Remix loaders** - Server-side data loading
- **Cookies** - Theme/locale persistence (`app/cookies.server.ts`)

### Cloudflare Integration

- **Pages Functions** - Serverless functions in `functions/[[path]].ts`
- **Environment variables** - Configured via Wrangler
- **Type bindings** - Generated via `pnpm typegen`

SSR via `@remix-run/cloudflare` with `renderToReadableStream` in `entry.server.tsx:22-43`.

## Development Patterns

### Adding a New Feature

1. Create feature directory: `app/features/<name>/`
2. Add components: `app/features/<name>/components/`
3. Add routes: `app/routes/<name>*.tsx`
4. Add content: `app/features/<name>/content/`
5. Update Vite plugins if build-time processing needed

### Component Organization

```
app/core/ui/
├── layout/         # Site-wide layout components (header, footer)
├── common/         # Reusable UI primitives
└── magic/          # Animated/effect components (globe, fireflies)
```

### Hooks Location

- Cross-cutting hooks → `app/core/hooks/`
- Feature-specific hooks → `app/features/<name>/hooks/`

### Path Aliases

Configured in `tsconfig.json:30-33`:
- `~/*` → `./app/*`
- `@components/*` → `./app/core/ui/*`

## Important Files

- **Remix Config**: Inline in `vite.config.ts:85-93` (future flags)
- **MDX Config**: `vite.config.ts:57-83` (rehype/remark plugins)
- **Tailwind Config**: `tailwind.config.ts`
- **Cloudflare Context**: `load-context.ts`
- **Environment**: No `.env` file (Cloudflare manages env vars)
- **Build Output**: `build/client` for deployment, `build/server` for functions

## Testing Notes

Tests are colocated next to source files as `*.test.ts[x]`. Current tests in:
- `app/core/config/scroll.test.ts`
- `app/core/utils/*.test.ts`

Vitest configured in `vitest.config.ts` with `@testing-library/jest-dom`.

## Internationalization

- Provider in `app/core/i18n/i18n-provider.tsx`
- Hook: `useTranslation()`
- Supported locales configured in `app/core/i18n/translations.ts`
- Cookie-based locale persistence (`app/cookies.server.ts`)

## Build System

- **Vite** with custom plugins for:
  - Blog metadata generation (`generatePostsMetadata`)
  - Book content virtual modules (`booksVirtualPlugin`)
  - Excalidraw file handling
  - CommonJS compatibility
- **MDX processing** at build time with Shiki Twoslash
- **TypeScript** with project references via path aliases
