# Workspace Lifecycle

Writer exposes one per-window Workspace Turn Lifecycle seam used by process-wide Agent Turn orchestration. It remains a preparation/reconciliation acknowledgement boundary, not an Agent Turn state machine.

## Ownership

- `editor-api.ts` owns the public Document durability and editor-control primitives. Workspace flushes reuse `flushSave`; they do not create a second write path. Reconciliation captures and applies open-Document snapshots only through this boundary.
- `workspace-api.ts` owns explicit reconciliation sequencing and filesystem I/O across the Workspace and editor domains.
- `workspace-store.ts` owns canonical Workspace generation, the active read-only lease, and lease-checked directory/index projection; it does not mutate editor state.
- `workspace-turn-lifecycle.ts` pairs preparation and reconciliation. The Rust Agent Turn coordinator invokes these window-local operations for every registered incarnation of the matching canonical Workspace through the identity-safe bridge documented in [assistant-turn-contract.md](./assistant-turn-contract.md).
- The filesystem watcher remains authoritative for ordinary external changes, but Agent Turn completion must use explicit reconciliation rather than waiting for watcher events.

## Contract

Preparation acquires an opaque `{ root, generation, id }` lease, makes editor surfaces read-only, and flushes all dirty Documents inside that exact canonical Workspace. It acknowledges only after durability and lease identity are both confirmed. Failure releases only the lease it acquired.

Reconciliation requires that lease. It forces the Rust Workspace index rescan, refreshes the root plus every cached or expanded directory, and reads an open-Document snapshot containing each path and stable Document instance identity. Confirmed missing directories are removed from cache/expansion state. Successful Document reads reload through the editor owner; confirmed deletions use the established editor delete cleanup; other read failures remain in the surfaced outcome. A reload or removal applies only when the same Document instance is still open at that path. Ordinary callers release their lease after the outcome exists; the Agent coordinator uses the retained-read-only option and explicitly releases only after every participant succeeds. Failed Agent reconciliation remains visibly blocking until participant withdrawal.

Workspace generation prevents delayed work for a closed Workspace from applying to or unlocking a later Workspace, including reopening the same canonical root. Document instance identity independently prevents a delayed read for a closed Document from overwriting or removing a new Document opened at the same path. A Document opened after reconciliation captures its snapshot is left alone.

## Coordinator boundary

This frontend seam does not own runtime discovery/spawning, ACP, Assistant state, process-wide coordination, cancellation, or permissions. Issue #12's Rust coordinator owns those responsibilities and calls this seam only for prepare and explicit reconcile. Conversation persistence/restore, focus context, quick actions, and grounded citations remain later AI-first Assistant tickets.
