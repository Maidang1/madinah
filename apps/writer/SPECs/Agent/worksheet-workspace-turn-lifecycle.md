# Workspace Turn Lifecycle Worksheet

## References

- TODO: `TODOS.md` → Workspace Turn Lifecycle prefactor (Done); parent AI-first Assistant remains Up Next
- Ticket: [GitHub #10](https://github.com/Maidang1/madinah/issues/10)
- Parent spec: [`../ai-first-acp-assistant-spec.md`](../ai-first-acp-assistant-spec.md), limited to the frontend Workspace Turn Lifecycle seam
- Baseline: `d7022d8`

## Constraints

- Prefactor only: no runtime discovery/spawning, ACP protocol work, Assistant UI, conversations, or Agent Turn coordinator.
- Preserve ordinary save, watcher, session, and editor behavior.
- Test only accepted public seams: Workspace Document flush, Workspace read-only control, and explicit reconciliation/reload.
- Preserve pre-existing `.gitignore` and `log/` work; do not edit or stage either.

## Baseline

- Working tree before this task: pre-existing modified `.gitignore`; pre-existing untracked `log/`.
- Local `node_modules/.bin/vp check`: pass (224 formatted, 139 linted).
- Local `node_modules/.bin/vp test`: pass (24 files, 292 tests).
- `cargo test`: pass (118 tests).
- `cargo clippy`: pass with nine pre-existing warnings.
- `cargo fmt --check`: pre-existing failure in `src-tauri/src/lib.rs:256`.
- Global `vp` is unavailable; use the repository-local binary.

## Investigation

- Reviewed: `CONTEXT.md`; issue #10; parent Assistant spec; ADR-0006, ADR-0007, and ADR-0012; agent loop/review protocol; consolidation, React, and Zustand guidelines.
- Existing Document durability owner: `src/lib/save.ts`; `flushSave(path)` already waits through edits observed during an in-flight write and rejects terminal save failures.
- Existing imperative editor seam: `src/hooks/editor-api.ts`; it exposes open Documents and disk reload without leaking the editor store to callers.
- Existing Workspace seam: `src/hooks/workspace-api.ts`; the Workspace store owns canonical root, directory cache, index projection, and already coordinates editor session state.
- Existing explicit backend rescan: `index_workspace`; it synchronously replaces the current webview's Rust file index and returns file count, but does not update the frontend projection or reload open Documents.
- Existing watcher reload is intentionally event-driven and non-authoritative; it reads a changed open Document and delegates to `editorApi.reloadFromDisk`.
- Existing editor surface: TipTap has no Workspace read-only projection today. A store-backed domain hook can drive TipTap's supported `editable`/`setEditable` API without callers reaching into the editor instance.
- Investigated but out of scope: Rust coordinator/process ownership, cancellation and partial-write policy (ADR-0007/0012), runtime discovery/spawning, Assistant UI/conversation state, Focus Context, and multi-window event routing.

## Plan

Public seam (exact contract):

- `prepareWorkspaceTurn(workspaceRoot) -> Promise<WorkspaceTurnLease>` in `src/hooks/workspace-turn-lifecycle.ts` verifies the canonical root, acquires one opaque `{ root, generation, id }` per-window lease (rejecting overlap), makes the Workspace read-only immediately, flushes every dirty open Document through `flushSave`, rechecks lease identity, and acknowledges only when both the lock and durability barrier hold. Any save/stale failure releases only its own lease before rejecting.
- `reconcileWorkspaceTurn(lease) -> Promise<WorkspaceReconciliationOutcome>` keeps the lease locked, delegates the explicit rescan/reload operation, returns a typed completed/completed-with-errors/stale/failed outcome with phase/path errors, and releases only that lease in `finally` after the outcome exists.
- This is a per-window preparation/reconciliation acknowledgement seam for the future process-wide Rust coordinator. It does not own Agent Turn state, multi-window discovery, runtime work, or cross-window rollback.

Implementation/test order:

1. Add public contract tests for successful multi-Document preparation; save failure rollback; editing rejected while leased and accepted after release; overlapping acquisition; root close/reopen (including same-root ABA) during deferred flush/reconciliation; and stale lease release not unlocking a newer Workspace.
2. TDD `editorApi.flushWorkspaceDocuments`, lease-scoped Workspace read-only acquire/release, and the public editor mutation behavior, reusing the existing save engine rather than adding a write path. Workspace generation increments on open/restore/close; close/restore invalidates the old lease.
3. Add a narrow Workspace read-only hook and make TipTap derive its supported `editable`/`setEditable` state from it. Keep selection available and preserve ordinary editing behavior when unlocked.
4. TDD one explicit Workspace reconcile operation: force `index_workspace`; refresh the root plus every cached or expanded directory and remove confirmed missing directories; read the open-Document path-and-instance snapshot; revalidate root generation/lease; then apply all successful reloads through the editor owner only when the captured Document instance is still current. Confirmed missing Documents use the same identity check before the existing delete cleanup path so they cannot remove a reopened Document or be autosaved back. Other per-Document failures are reported while successful reloads still apply. Index/root-directory failure is a blocking failed outcome. Documents opened after the snapshot are untouched.
5. TDD lifecycle sequencing and typed outcomes, including guaranteed lease-checked unlock after completed, mixed, blocking-failure, and stale reconciliation outcomes without any watcher event.
6. Add the owning Workspace lifecycle doc, update this worksheet/TODO without marking the parent AI-first feature Done, and run targeted then full validation.

Risks/edges: transient read-only during a failed prepare is intentional to close the flush/lock race; sidebar create/rename/delete exclusion across windows belongs to the later coordinator; confirmed missing Documents close through established editor delete behavior; non-missing read failures remain surfaced and their stale Document is not rewritten by reconciliation itself.

## Plan Review

- Startup/Workspace P1s: resolved by lock-before-flush acknowledgement, Workspace generation plus lease identity, refresh of every cached/expanded directory, and confirmed-deletion cleanup before unlock.
- Systems Architect P1s: resolved by the same prepare invariant and opaque lease; exact public contracts and lifecycle-vs-future-coordinator ownership are now explicit.
- QA P1s: resolved by public edit-rejection coverage, mixed reconciliation outcomes with successful batch reload, and deferred root/generation race tests. QA re-review: green, no P0/P1; accepted optional coverage for `updateFrontmatter` while leased.
- Duplicate Startup/Workspace and Systems Architect confirmation reviewers exceeded the final review wait and were stopped; recorded as review-tool timeouts. React/Frontend, Zustand/State, and Editor plan personas did not return within the review-tool window; recorded as review-tool timeouts per the human review gate.
- Gate: no unresolved P0/P1 remains in the revised plan; proceed with public-contract-first TDD.

## Result

- Added `prepareWorkspaceTurn` / `reconcileWorkspaceTurn` as per-window, lease-scoped acknowledgements for the later Rust coordinator; no Agent Turn state machine or Assistant/runtime surface was added.
- Workspace generation plus opaque lease identity rejects overlap and prevents stale close/reopen work from applying or unlocking a newer lifecycle.
- Workspace Document flush reuses `flushSave`, filters by exact canonical-root membership, waits for all attempted saves, and reports path-specific failures.
- TipTap derives read-only state from the Workspace domain hook; public body/frontmatter mutations bail out while leased.
- Explicit reconciliation forces `index_workspace`, refreshes root/cached/expanded directory state, reloads successful open Documents, closes confirmed deletions through existing cleanup, surfaces other read failures, and never depends on watcher delivery.
- Reconciliation sequencing and filesystem I/O live in `workspace-api.ts`; `workspace-store.ts` applies only its lease-checked Workspace projection, while `editor-api.ts` exclusively owns Document snapshot capture and identity-checked reload/removal.
- Added 16 public lifecycle contract tests, including a deferred same-path close/reopen regression that proves stale content cannot overwrite the new Document instance.
- No changelog entry: this ticket intentionally preserves user-visible behavior and only establishes a prefactor seam.
- Follow-up independent two-axis review gate: Spec re-review passed; Standards re-review confirmed the same-path Document identity race and editor ownership blockers are resolved. Its remaining must-fix same-directory import finding was fixed by changing `workspace-api.ts` to import `./editor-api`; the post-fix focused check passed. No unresolved P0/P1 remains. Duplicate internal reviewers were stopped without waiting for redundant results.
- Final validation: local `vp check` pass (229 formatted, 142 linted); local `vp test` pass (25 files, 308 tests); `cargo test` pass (118 tests); `cargo clippy` pass with the same nine pre-existing warnings; `git diff --check` pass. After the import fix, `vp check`, focused lifecycle/editor API tests (20 tests), TypeScript, and `git diff --check` all passed again.
- `cargo fmt --check` retains the baseline-only failure at `src-tauri/src/lib.rs:256`; no Rust file is part of this ticket, so the unrelated drift remains untouched.
- TODO slice moved to Done without marking the parent AI-first Assistant Done. Ready for the single implementation commit.
