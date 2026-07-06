# Releasing Writer

How to cut a signed, notarized macOS release and publish it so the in-app updater picks it up.

Writer has two release paths:

- GitHub Actions: `.github/workflows/writer-release.yml` builds a signed macOS draft release from a `v<version>` tag or manual workflow dispatch.
- Local fallback: `scripts/distribute.sh` builds and publishes the same assets from a maintainer Mac.

## Pre-flight Checks

Before bumping anything:

- `vp check` and `vp test` pass.
- The `CHANGELOG.md` entry for this release already exists. If it doesn't, write it first as a separate commit — release commits should only touch version fields.

`scripts/distribute.sh` enforces the rest itself: it refuses to run unless you're on `master` with a clean working tree, fast-forward of `origin/master`, and the target tag doesn't already exist locally or on origin.

## Step 1 — Bump the version

The authoritative version lives in `src-tauri/tauri.conf.json`. `scripts/distribute.sh` reads it from there to derive the tag (`v<version>`) and DMG filename. Three other files must be kept in sync so the crate, npm package, and Tauri config all agree:

1. `src-tauri/tauri.conf.json` — `version` field
2. `src-tauri/Cargo.toml` — `[package].version`
3. `package.json` — `version` field
4. `src-tauri/Cargo.lock` — refresh with `cargo update -p desktop --offline` from `src-tauri/`

Use a patch bump for fixes and small improvements, a minor bump for new user-visible features. Major bumps are reserved for breaking changes or 1.0.

Commit with a message like `Bump version to <version>`. Do not bundle other changes into the bump commit so it stays reviewable in isolation.

For the GitHub Actions path, push the release commit and then push `v<version>`, or run the workflow manually. For the local fallback path, let `scripts/distribute.sh` push and tag.

## Step 2 — Draft user-facing release notes

The detailed bullets in `CHANGELOG.md` are written for engineers — too long and too jargon-heavy for the GitHub release page. The agent drafts a short, user-facing version from the latest dated section of `CHANGELOG.md` and writes it to a markdown file (any path; a temp file is fine).

Guidelines for the drafted notes:

- 3–8 bullets, one short line each. Lead with the user-visible behavior, not the implementation.
- Group as you see fit — typically a short intro paragraph (optional) plus bullets, no headings needed.
- No code spans for internal symbols (`view.setState`, `--surface-card`, etc.) and no spec/PR references.
- Keep wording in the same voice as the existing CHANGELOG (active, terse, sentence case).

The draft is not the final word — you'll review and can edit it directly on GitHub before publishing.

## Step 3 — Release

### Option A: GitHub Actions

Required repository secrets:

- `APPLE_CERTIFICATE` — base64-encoded Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD` — password for the `.p12`
- `KEYCHAIN_PASSWORD` — temporary CI keychain password
- `APPLE_ID` — Apple ID email
- `APPLE_PASSWORD` — Apple app-specific password
- `APPLE_TEAM_ID` — Apple team ID
- `TAURI_SIGNING_PRIVATE_KEY` — private key for updater signatures
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — updater key password, empty if the key has none
- `WRITER_RELEASE_TOKEN` — GitHub token with release write access to the updater endpoint repository when it differs from the workflow repository

Run either:

```sh
git tag v<version>
git push origin v<version>
```

Or trigger **Writer Release** from GitHub Actions and optionally provide short release notes. The workflow reads the updater endpoint in `src-tauri/tauri.conf.json`, publishes a draft GitHub Release to that repository, uploads the DMG, updater archive, signatures, and `latest.json`, then leaves the release in draft state for review.

### Option B: Local fallback

Run from the repo root, passing the notes file:

```sh
./scripts/distribute.sh --notes-file /tmp/release-notes.md
```

The script will, in order:

1. Validate `.env`, signing credentials, and the notes file (must exist and be non-empty).
2. Run pre-flight git checks (on master, clean tree, fast-forward of origin, tag doesn't already exist).
3. Push `master` to origin so the commit the release will point at is published before the build starts.
4. Build the desktop crate in release mode (`vp exec tauri build --bundles app,dmg`).
5. Sign `Writer.app` and the DMG with the Developer ID identity from `.env`.
6. Submit the app to Apple notarization and wait for the result. This is the slowest step and the most likely to fail — if Apple returns anything other than `Accepted`, stop and report the notarization log to the user.
7. Staple the notarization ticket to the app.
8. Bundle `Writer.app.tar.gz` and produce `Writer.app.tar.gz.sig` using the Tauri updater key.
9. Write `latest.json` with the new version, signature, and download URL pointing at `Maidang1/writer-computer`.
10. Create a **draft** release on `Maidang1/writer-computer` via `gh release create --draft`, uploading the DMG, the updater tarball, and `latest.json`, with the drafted notes attached.
11. Tag this repo with `v<version>` and push the tag to origin.
12. Print the draft URL.

Expect the whole script to take several minutes — most of it is the cargo release build and Apple notarization.

## Step 4 — Review and publish on GitHub

Open the draft release URL from the workflow summary or from `distribute.sh`. Confirm:

- Three assets are attached: `Writer_<version>_aarch64.dmg`, `Writer.app.tar.gz`, `latest.json`.
- The notes read well; edit them inline if needed.

Click **Publish release**. Until you do, the in-app updater won't see the new version (the `latest` endpoint skips drafts). If you abandon the draft instead, delete the local and remote tag manually (`git tag -d v<version> && git push origin :refs/tags/v<version>`).

## Step 5 — Verify

- Confirm `https://github.com/Maidang1/writer-computer/releases/latest/download/latest.json` resolves to the new version. The in-app updater hits this URL on launch (see `src-tauri/tauri.conf.json`).
- Existing installs will pick up the update on next launch.

Before publishing a fork-owned release, replace the updater `pubkey` in `src-tauri/tauri.conf.json` with the public key matching this fork's `TAURI_SIGNING_PRIVATE_KEY`.

## When things go wrong

- **Pre-flight check fails.** The script aborted before doing anything irreversible. Read the error, fix the underlying state (commit, pull, bump version, etc.), and re-run.
- **Notarization fails.** Apple's response includes a submission ID. Ask the user how to proceed — do not retry blindly. Common causes: an entitlement mismatch, an unsigned binary inside the bundle, or an expired signing identity.
- **`gh release create` fails because the tag already exists in `writer-computer`.** A previous attempt got far enough to publish. Do not delete the existing release without explicit user permission — it may already be live to users via the updater. Ask first.
- **Build fails after the version bump is committed.** Fix the build, commit the fix, and re-run `distribute.sh`. Do not amend or revert the bump commit unless the user asks for it.
- **The script succeeded but the local tag push failed.** The draft is created; you just need to push the tag. Run `git push origin v<version>` manually. Don't re-run the whole script.
- **You decide not to publish the draft.** Delete the draft on GitHub, then drop the tag: `git tag -d v<version> && git push origin :refs/tags/v<version>`.
- **You realize mid-release that the version was wrong.** Stop. Revert is risky once the GH release exists. Ask the user before taking any destructive action.

## Current scope

- macOS arm64 is the supported release target.
- GitHub Actions is the preferred release path when the required signing, notarization, updater, and release-token secrets are configured.
- `scripts/distribute.sh` remains the local fallback for a maintainer Mac.
- Rolling back a published release needs a separate written procedure and explicit maintainer approval.
