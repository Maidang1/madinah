# Assistant Turn IPC Contract

Issue #12 implements one temporary, serialized ACP Agent Turn. Rust is the normative owner of the process, ACP session, permission responder, and process-wide coordinator. The coordinator is keyed by canonical Workspace path; there is no frontend queue and no durable Conversation in this slice.

## Consent and selection

AI Access Consent is stored per canonical Workspace. It is never shared with another Workspace, even when windows are open concurrently. Before granting, Writer explains that the selected Agent may use cloud services, receives unrestricted read/write access to the whole Workspace (including ignored and non-Document files), writes directly without an Apply step, and cannot be rolled back by Writer.

The frontend starts a turn with a compatible discovery identity and the exact registration revision, never an arbitrary command. Rust reloads that snapshot before launch. Built-ins launch through their installed executable; custom runtimes retain the immutable, private-copy binding and self-contained-native constraints in [assistant-discovery-contract.md](./assistant-discovery-contract.md).

## Serialized lifecycle

Each frontend Workspace generation installs its event listener before registering an exact `{canonical root, Rust Workspace epoch, frontend generation, bridge id}` lifecycle bridge. Send remains unavailable until registration succeeds. Closing, switching, or destroying the window unregisters that bridge; a replacement bridge identity-safely withdraws the older incarnation, and delayed old cleanup cannot remove the replacement.

For one accepted send, Rust reserves the canonical Workspace and snapshots every registered window for that same Workspace. A second start is rejected in every active phase; it is not queued. Rust then:

1. emits an identity-bound prepare request to each participant;
2. waits for each window to acquire the #10 read-only lease and flush every open Document;
3. aborts before process launch if any save/prepare fails, reconciling leases already acquired;
4. runs `initialize -> session/new -> session/prompt` with the canonical Workspace as `cwd`;
5. projects bounded streamed text, change summaries, and an explicit one-shot permission request;
6. cleans up and confirms process reap, then emits identity-bound reconciliation requests on success or failure;
7. retains every acquired #10 lease until every participant reports successful reconciliation, then emits the terminal event that releases all window-local leases; a failed or timed-out participant instead produces a visible nonterminal `reconciliation-blocked` state until that participant is withdrawn.

Every prepare/reconcile acknowledgement includes the turn, canonical root, Rust epoch, participant token, bridge id, phase-specific request id, and the exact frontend lease generation/id. Rust derives the window label from the IPC invocation and rejects stale, reordered, duplicated, or cross-window identities. This prevents same-root close/reopen ABA from preparing or unlocking a later Workspace incarnation.

During an active turn, TipTap and sidebar mutation surfaces follow the read-only lease. Rust derives the mutation target's current canonical Workspace, atomically acquires a coordinator permit before an Agent reservation can win, and holds it through the actual blocking write/create/rename/delete/image I/O. The prepare flush is the only Writer write permitted after reservation and carries the exact turn/participant/prepare-request identity; a stale window/path or ordinary delayed save is rejected. Workspace publication uses the same coordinator gate, so switching cannot overtake an in-flight Writer mutation. This is application serialization, not an operating-system filesystem lock: the trusted Agent remains unrestricted and partial writes remain on disk after failure.

## ACP projection and bounds

The runtime uses the ACP SDK 2.0 protocol-v1 model. Session-correlated text updates are appended to the temporary Conversation; bounded tool metadata becomes a visible change summary. Permission requests surface only Agent-provided `allow-once`/`reject-once` choices plus cancel. Persistent `allow-always`/`reject-always` choices are never forwarded; a request with no one-shot choice is cancelled. One exact decision is accepted for the current turn/request and is never persisted or automatically reused.

Prompts are limited to 64 KiB, protocol lines to 1 MiB, projected text to 2 MiB, and change summaries to 128 entries of 4 KiB each. Prepare and reconcile waits are 60 seconds, permission waits 10 minutes, and the complete turn 30 minutes. Cancellation from Workspace/window teardown interrupts binding or protocol work, terminates the process group/direct child, confirms reap, and removes any private executable artifact before reconciliation.

## Wire ownership and tests

Rust serde models under `src-tauri/src/assistant/` own the wire. `src/platform/tauri/assistant.ts` mirrors them. [`shared/assistant-turn-wire.json`](../shared/assistant-turn-wire.json) is consumed by Rust and TypeScript exact-roundtrip tests so event tags, casing, and lifecycle identity cannot drift silently.

The desktop command tests invoke the serialized Tauri adapters with a deterministic native fake ACP Agent. They cover per-Workspace consent, prepare failure before spawn, successful stream/permission/reconcile/unlock, write-then-crash reconciliation, partial-write visibility, process cleanup, bridge removal, and the real serialized write boundary's stale-path/prepare-identity enforcement. Frontend tests observe the public #10 prepare/reconcile/retained-release seam, exact generation-bound reconciliation state, and rendered consent/permission/output behavior.

The single temporary Conversation is terminal after its first result; creating another Conversation, persistence/restore, focus context, quick actions, citations, and Agent Stop controls remain later tickets.
