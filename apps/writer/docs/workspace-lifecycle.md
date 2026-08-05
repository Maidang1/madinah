# Workspace Lifecycle

Writer exposes one per-window Workspace Turn Lifecycle seam for later process-wide Agent Turn orchestration. It is a preparation/reconciliation acknowledgement boundary, not an Agent Turn state machine.

## Ownership

- `editor-api.ts` owns the public Document durability and editor-control primitives. Workspace flushes reuse `flushSave`; they do not create a second write path. Reconciliation captures and applies open-Document snapshots only through this boundary.
- `workspace-api.ts` owns explicit reconciliation sequencing and filesystem I/O across the Workspace and editor domains.
- `workspace-store.ts` owns canonical Workspace generation, the active read-only lease, and lease-checked directory/index projection; it does not mutate editor state.
- `workspace-turn-lifecycle.ts` pairs preparation and reconciliation. A future Rust coordinator will invoke these window-local operations for every matching canonical Workspace.
- The filesystem watcher remains authoritative for ordinary external changes, but Agent Turn completion must use explicit reconciliation rather than waiting for watcher events.

## Contract

Preparation acquires an opaque `{ root, generation, id }` lease, makes editor surfaces read-only, and flushes all dirty Documents inside that exact canonical Workspace. It acknowledges only after durability and lease identity are both confirmed. Failure releases only the lease it acquired.

Reconciliation requires that lease. It forces the Rust Workspace index rescan, refreshes the root plus every cached or expanded directory, and reads an open-Document snapshot containing each path and stable Document instance identity. Confirmed missing directories are removed from cache/expansion state. Successful Document reads reload through the editor owner; confirmed deletions use the established editor delete cleanup; other read failures remain in the surfaced outcome. A reload or removal applies only when the same Document instance is still open at that path. The lifecycle releases only its own lease after the outcome exists.

Workspace generation prevents delayed work for a closed Workspace from applying to or unlocking a later Workspace, including reopening the same canonical root. Document instance identity independently prevents a delayed read for a closed Document from overwriting or removing a new Document opened at the same path. A Document opened after reconciliation captures its snapshot is left alone.

## Deferred Scope

Runtime discovery/spawning, ACP, Assistant UI and Conversations, process-wide multi-window coordination, turn state, cancellation, and permissions belong to later AI-first Assistant tickets. This seam must stay reusable by that coordinator without independently acquiring those responsibilities.
