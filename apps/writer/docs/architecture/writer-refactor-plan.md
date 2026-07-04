# Writer Architecture Refactor Plan

Status: complete

## Baseline

- `./node_modules/.bin/vitest run`: passed, 54 files and 239 tests.
- `./node_modules/.bin/tsc --noEmit`: passed.
- `./node_modules/.bin/electron-rsbuild build`: passed.

## Goals

- Keep the existing `domain / features / platform / electron / command` architecture.
- Thin `src/App.tsx` by moving reusable orchestration into feature hooks.
- Make document origin explicit with a `DocumentSource` model.
- Normalize command surfaces so menus, palette, context menus, and slash share one command registry with clear visibility rules.
- Harden workspace plugin contributions with runtime capability validation.
- Align Electron file-tree watching with multi-root renderer state.
- Move heavy preview compilation behind a worker-backed API while keeping the public `engine.compilePreview(source)` contract.

## Execution Order

1. Extract app orchestration hooks.
2. Introduce `DocumentSource`.
3. Normalize command surfaces.
4. Harden plugin capabilities.
5. Support multi-root Electron watchers.
6. Move preview compilation to a worker-backed module.

## Progress

- [x] Baseline verified.
- [x] App orchestration hooks extracted.
- [x] Document source model introduced.
- [x] Command surfaces normalized.
- [x] Plugin capabilities hardened.
- [x] Multi-root watcher support added.
- [x] Worker-backed preview compilation added.
- [x] Final verification passed.
