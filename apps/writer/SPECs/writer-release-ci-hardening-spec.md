# Writer Release CI Hardening Spec

## Goal

Make the Writer GitHub Actions release path safely resumable, fail early when
release configuration is incomplete, and publish a traceable macOS draft
release whose updater assets are verified before the workflow succeeds.

## Scope

- Keep `src-tauri/tauri.conf.json` as the authority for the Writer version and
  updater release repository.
- Share release metadata validation between GitHub Actions and the local
  `scripts/distribute.sh` fallback.
- Support version tags and manual dispatches from the source repository's
  default branch.
- Resolve the release repository's default branch instead of assuming it is
  the same as the source repository's default branch.
- Fail before dependency installation and compilation when the cross-repo
  token, trigger ref, version files, updater endpoint, or target repository is
  invalid.
- Run frontend and Rust quality gates before packaging.
- Build a signed, notarized arm64 macOS app and upload the DMG, updater archive,
  updater signature, and `latest.json` to a draft GitHub Release.
- Verify the draft contains all required assets before recording a source tag
  for a manual dispatch.
- Serialize releases without canceling an in-progress signing or upload job.
- Pin reusable GitHub Actions to immutable commit SHAs.

## Release ownership and provenance

- `WRITER_RELEASE_TOKEN` is used only for reads and writes against the updater
  release repository. The source repository's `github.token` is used only for
  source checkout and compare-and-create of a manual-dispatch source tag.
- Every managed draft body contains a machine-readable marker with the source
  repository, exact source commit SHA, and publisher (`github-actions` or
  `local`), followed by human-readable source and workflow links.
- A source version tag must point exactly at the commit that produced the
  release. A missing source tag is created only after all draft assets pass
  semantic validation; an existing tag at the same commit is accepted, and a
  tag at any other commit is a hard failure.

## Existing-state decisions

| Target state                                  | Source provenance                | Decision                                                                                                    |
| --------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| No release and no target tag                  | Current source SHA               | Atomically create an Actions-owned empty draft before the expensive build, then use it as the release claim |
| Actions-owned draft, including partial assets | Same source repository and SHA   | Resume; Tauri Action deterministically replaces same-named assets, then re-verify everything                |
| Managed draft                                 | Different source SHA             | Fail without mutation                                                                                       |
| Local-owned or unmanaged draft                | Any or missing provenance marker | Fail without mutation                                                                                       |
| Published release                             | Any                              | Fail without mutation                                                                                       |
| Target tag without a release                  | Any                              | Fail without mutation                                                                                       |

The local fallback is deliberately create-only. It checks for pre-existing
state before building, then uses `gh release create` to atomically claim the tag
with a local-owned provenance marker when uploading. If Actions claimed it in
the meantime, local creation fails without replacing Actions assets. Conversely,
Actions claims a new version before building and never resumes a local-owned
draft. Recovery of an Actions-owned partial draft happens only in Actions,
where fixed concurrency and provenance checks apply.

## Non-goals

- Publishing the draft release automatically.
- Adding Windows, Linux, Intel macOS, or universal macOS builds.
- Creating or rotating Apple, updater-signing, or GitHub credentials.
- Changing the Writer application version.

## Validation

- Table-driven unit tests for shared release metadata parsing, remote release
  state decisions, source-tag decisions, and semantic updater-asset validation.
- `actionlint` for `.github/workflows/writer-release.yml`.
- `bash -n apps/writer/scripts/distribute.sh`.
- `vp check`, `vp test`, and the Writer build.
- `cargo fmt --all -- --check`, `cargo test --locked`, and
  `cargo clippy --locked --all-targets`.
- `git diff --check` scoped to this task's files.
