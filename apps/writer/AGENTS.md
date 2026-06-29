# Repository Guidelines

## Project Structure & Module Organization

This is the Madinah Writer desktop app, built with React, Vite, TypeScript, Tailwind, and Tauri. Frontend code lives in `src/`: `App.tsx` composes the workbench, `features/` holds editor, command, session, search, outline, history, file-tree, and AI-polish flows, `domain/` holds shared document and engine types, `platform/` separates browser and Tauri adapters, `lib/` contains Markdown/MDX utilities, and `styles/app.css` owns app and preview styling. Rust/Tauri code lives in `src-tauri/src`, with integration tests in `src-tauri/tests` and icons/config under `src-tauri/`.

## Build, Test, and Development Commands

- `pnpm dev`: start the Vite frontend on `127.0.0.1:1420`.
- `pnpm tauri:dev`: run the desktop shell with the local frontend.
- `pnpm build`: run `tsc --noEmit` and `vite build`.
- `pnpm test`: run Vitest once.
- `pnpm tauri:build`: build the macOS app bundle.
- `cd src-tauri && cargo test`: run Rust unit and integration tests.

When local pnpm policy blocks scripts, use repo-local binaries: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, and `./node_modules/.bin/vite build`.

## Coding Style & Naming Conventions

Use strict TypeScript, ES modules, React function components, and 2-space indentation for TS/TSX/CSS/JSON. Use Rust 2021 with `rustfmt` defaults. Name React components in `PascalCase`, hooks as `useSomething`, tests as `*.test.ts` or `*.test.tsx`, and feature folders by product area, such as `features/session` or `features/file-tree`. Keep command IDs stable and dotted, for example `document.saveAs`.

## Testing Guidelines

Vitest is configured in `vite.config.ts` with `globals: true` and `environment: "node"`. Place focused tests next to the code they cover in `src/lib`, `src/domain`, `src/styles`, or feature folders. Add Rust tests in module `#[cfg(test)]` blocks or `src-tauri/tests` when behavior crosses Tauri command or filesystem boundaries.

## Commit & Pull Request Guidelines

Recent history uses short Conventional Commit-style subjects, commonly `feat: ...`, `feat(writer): ...`, and `style: ...`. Keep commits scoped to one behavior or cleanup. Pull requests should include the user-facing change, touched areas, validation commands, linked issue or task, and screenshots for UI or preview changes.

## Agent-Specific Rendering Rules

Light mode chrome and rendered Markdown/MDX must keep the Madinah blog warm reader palette. Use the blog `reader-*` tokens from `/Users/bytedance/codes/myself/madinah/src/styles/global.css`, preserve the Jinkai font loaded by `index.html`, and keep `src/styles/app.css` as the writer-side alignment point. Before changing preview rendering, compare against the real blog surface under `/Users/bytedance/codes/myself/madinah/src`.
