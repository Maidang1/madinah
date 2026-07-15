# Writer Release CI Hardening Worksheet

## Task

- TODO: harden the Writer GitHub Actions release pipeline.
- Spec: [`../writer-release-ci-hardening-spec.md`](../writer-release-ci-hardening-spec.md)

## Workspace State

- The repository was already dirty with an unrelated Notion-style slash menu
  task in `TODOS.md`, its spec, editor sources, and tests. Those changes are
  preserved and excluded from this task's commit.
- `main` advanced from one to three local commits ahead of `origin/main` while
  this task was in progress. A separate TipTap/old-Prosemark cleanup is also
  active in the shared worktree. This task does not rewrite, push, stage, or
  otherwise absorb that work.

## Reviewed

- `.github/workflows/writer-release.yml`
- `scripts/distribute.sh`
- `docs/releasing.md` and `README.md`
- `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and `package.json`
- Tauri `tauri-action` inputs and GitHub Actions concurrency/security guidance
- Live GitHub metadata for `Maidang1/madinah` and
  `Maidang1/writer-computer`

## Findings

- The source repository uses `main`, while the release repository uses
  `master`; the workflow hard-codes `releaseCommitish: main`, so first-time
  release creation in the target repository cannot resolve the commitish.
- No Writer release workflow runs exist yet and the source repository currently
  has none of the documented Actions secrets configured.
- `actions/setup-node` requests a pnpm cache before the workflow installs pnpm.
- Release concurrency is keyed by ref and cancels an in-progress run, allowing
  two refs to publish concurrently and allowing a newer run to interrupt
  signing/upload work.
- Manual dispatch can publish artifacts without creating the matching version
  tag in the source repository.
- The workflow omits Rust tests, formatting, and Clippy gates.
- GitHub Actions references are movable tags, despite the job receiving Apple,
  updater-signing, and cross-repository release secrets.
- The local fallback still requires `master`, hard-codes the release repository,
  and does not upload the standalone updater signature.

## Plan

1. Add a small shared Node module that validates all version files, parses the
   updater endpoint, extracts default release notes from the current changelog
   section, owns the remote-state decision table and semantic asset checks, and
   writes GitHub step outputs. Cover its pure functions with table-driven Node
   tests and include them in the package test command.
2. Rebuild the workflow preflight around that module, resolve the target default
   branch via the GitHub API, validate cross-repo credentials and trigger refs,
   and stop before compilation on configuration failures.
3. Give the target PAT and source `github.token` separate responsibilities.
   Record a source repo/SHA/publisher provenance marker and run link in the
   draft body. Actions atomically claims a new version with an empty draft
   before building and resumes only an Actions-owned draft with identical
   provenance; it never mutates published, local-owned, or unmanaged releases.
   Compare-and-create the source tag only after semantic asset validation.
4. Make action setup deterministic and pinned, serialize release runs without
   cancellation and with a full pending queue, add frontend/Rust gates, and
   harden temporary keychain handling and cleanup.
5. Align the local fallback with shared metadata, the dynamically resolved
   source default branch, create-only remote semantics, a local publisher claim,
   fresh artifact selection, and the same four release assets. Its final
   `gh release create` competes atomically with the Actions claim instead of
   relying on a time-of-check workflow-status query.
   Update the release guide, README, changelog, and TODO.
6. Run focused and full validation, review the implementation, resolve blocking
   findings, and commit only this task's files.

## Plan Review

- Systems architecture and QA reviews both blocked the first draft on implicit
  rerun semantics and incomplete provenance. The revised plan adds the explicit
  state table above, separates source and target credentials, records the exact
  source SHA in every managed draft, refuses published/unmanaged states, and
  validates before source tag creation.
- QA additionally required semantic verification of the updater manifest, not
  only asset-name presence. The verifier will check draft/provenance, unique
  non-empty assets, version, expected arm64 platform keys, archive asset URL,
  and equality between the manifest signature and uploaded `.sig` content.
- The first real Apple signing/notarization run remains an operational gap
  because the repository currently has no release secrets and no historical
  Writer Release run. The workflow will expose that as an early, explicit
  failure until maintainers configure the documented secrets.
- The architecture re-review found that merely checking for active workflow
  runs leaves a TOCTOU gap with the local fallback. The final plan uses the
  target draft/tag as the atomic release claim and includes a publisher in its
  provenance marker, so Actions and local publishing never resume or overwrite
  each other's draft.

## Result

- Added `scripts/release-config.mjs` as the shared owner for version/updater
  metadata, release-note extraction, provenance bodies, target state decisions,
  target draft claims, source-tag decisions, remote/local semantic asset
  validation, and GitHub output encoding.
- Added six Node test groups covering config authority, parser failures,
  provenance, target release state, source tag compare-and-create, and updater
  artifact semantics; wired them into the package `test` command.
- Rebuilt `writer-release.yml` around early credential/ref checks, an
  Actions-owned target claim, pinned Actions, non-canceling full-queue
  concurrency, frontend/Rust gates, ephemeral keychain cleanup, `tauri-action`
  upload by release ID, semantic verification, and post-verification manual
  source tagging.
- Aligned `distribute.sh` to the shared metadata/verification owner, dynamic
  source and target defaults, create-only local provenance, fresh artifact
  selection, and the same four assets.
- Updated release docs, README, changelog, and task tracking.

Validation completed so far:

- `node --test scripts/release-config.node-test.mjs`: 6/6 passed.
- Package tests: 40 files and 552 existing tests passed, followed by 6/6 release
  tests.
- Targeted Vite+ formatting and lint for all release-owned files passed.
- `shellcheck` and `bash -n` passed for `scripts/distribute.sh`.
- actionlint v1.7.12 passed while ignoring only its known pre-schema diagnostic
  for GitHub's supported `concurrency.queue` key.
- `cargo fmt --all -- --check`, 137 Rust tests, and
  `cargo clippy --locked --all-targets` passed. Existing non-fatal Rust warnings
  remain outside this task.
- Full-package `vp check` is temporarily blocked by the concurrently edited
  `tiptap-slash-commands.ts`; no release-owned file is implicated. Re-run after
  that worktree change stabilizes.
- A live signing/notarization/upload run is unavailable because the repository
  currently has none of the required Writer release secrets. The workflow now
  reports each missing secret before claiming a target draft.
