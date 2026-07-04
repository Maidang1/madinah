# Repository Guidelines

## Project Structure & Module Organization

This is the Madinah Writer desktop app, built with React, Rsbuild, TypeScript, Tailwind, and Electron. Frontend code lives in `src/`: `App.tsx` composes the workbench, `features/` holds editor, command, session, search, outline, history, file-tree, and AI-polish flows, `domain/` holds shared document and engine types, `platform/` separates browser and Electron adapters, `lib/` contains Markdown/MDX utilities, and `styles/app.css` owns app and preview styling. Electron main and preload code lives in `electron/`, with Node backend tests beside the backend implementation. Builder icons and app resources live in `buildResources/` and `public/`.

## Build, Test, and Development Commands

- `pnpm dev`: start the Electron/Rsbuild development shell.
- `pnpm build`: run `tsc --noEmit` and `electron-rsbuild build`.
- `pnpm test`: run Vitest once.
- `pnpm electron:build`: build the macOS app bundle with electron-builder.

When local pnpm policy blocks scripts, use repo-local binaries: `./node_modules/.bin/vitest run`, `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/electron-rsbuild build`, and `./node_modules/.bin/electron-builder --mac`.

## Coding Style & Naming Conventions

Use strict TypeScript, ES modules, React function components, and 2-space indentation for TS/TSX/CSS/JSON. Electron main and preload outputs are CommonJS because the app package uses `"type": "module"`. Name React components in `PascalCase`, hooks as `useSomething`, tests as `*.test.ts` or `*.test.tsx`, and feature folders by product area, such as `features/session` or `features/file-tree`. Keep command IDs stable and dotted, for example `document.saveAs`.

## Testing Guidelines

Vitest is configured in `vitest.config.ts` with `globals: true` and `environment: "node"`. Place focused tests next to the code they cover in `src/lib`, `src/domain`, `src/styles`, feature folders, or `electron/main`. Add Node backend tests when behavior crosses Electron IPC, filesystem, workspace, assets, or ACP boundaries.

## Commit & Pull Request Guidelines

Recent history uses short Conventional Commit-style subjects, commonly `feat: ...`, `feat(writer): ...`, and `style: ...`. Keep commits scoped to one behavior or cleanup. Pull requests should include the user-facing change, touched areas, validation commands, linked issue or task, and screenshots for UI or preview changes.

## Agent-Specific Rendering Rules

Light mode chrome and rendered Markdown/MDX must keep the Madinah blog warm reader palette. Use the blog `reader-*` tokens from `/Users/bytedance/codes/myself/madinah/src/styles/global.css`, preserve the Jinkai font loaded by `index.html`, and keep `src/styles/app.css` as the writer-side alignment point. Before changing preview rendering, compare against the real blog surface under `/Users/bytedance/codes/myself/madinah/src`.

## Editor Command & Slash Rules

Editor insertion flows should reuse the ordinary `WriterCommand` surface, especially `editor.insert.*`, so command palette, menus, slash actions, and plugin contributions stay aligned. The editor core is CodeMirror 6 with Writer-owned Markdown decorations; keep Markdown source as the editor truth and expose behavior through the `WriterEditor` adapter. Slash-triggered insertion in rich text should replace the active `/query` range in CodeMirror state while still flowing through `onChange`; DOM `Range`, `execCommand`, and raw rich-text insertion are brittle for Markdown block syntax. Keyboard handling for the slash menu should run on the editor shell capture phase, with ArrowUp, ArrowDown, Enter, and Escape handled before CodeMirror keymaps. Keep document-level AI polish on the editor context menu, while slash remains focused on fast writing inserts and lightweight inline formatting.
