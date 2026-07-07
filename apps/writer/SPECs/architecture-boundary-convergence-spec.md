# Architecture Boundary Convergence

## Goal

Tighten Writer's module boundaries without changing user-visible behavior.

## Current Pressure Points

- Document session rules live inside the editor store, making tab/history/path behavior harder to test in isolation.
- Startup, watcher, and workspace flows can still mutate Zustand state directly from outside the owning store.
- The frontend Tauri bridge has all command groups in one file, while Rust command modules already group by domain.
- A few components still know about store modules directly.

## Decisions

- `domain/editor-session` owns document session types, tab factories, path-rewrite helpers, and session snapshot serialization.
- Store mutation entry points stay on the owning store. Startup and watcher glue call store actions rather than `setState`.
- `platform/tauri` is the canonical frontend IPC boundary, split by command group. `lib/tauri` remains as the compatibility export surface.
- Components consume state through `hooks/` or imperative hook APIs, never through `stores/`.
- Rust command functions remain the Tauri IPC surface; reusable command logic can move into command-local support modules.

## Acceptance Criteria

- Existing Writer tests pass.
- Component files have no direct imports from `@/stores/*`.
- Production code outside store owner files has no direct `use*Store.setState` writes.
- `@/lib/tauri` keeps existing exports so current imports and tests continue to work.
- Root blog drafts remain untouched.
