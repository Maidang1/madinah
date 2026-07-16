# Writer release workflow

## Goal

Ship the signed Apple Silicon macOS app through one understandable path.

## Design

- `src-tauri/tauri.conf.json` is the release version authority.
- A matching `v<version>` tag pushed to `Maidang1/madinah` is the only trigger.
- GitHub Actions imports the Apple certificate and delegates the build, notarization,
  updater artifacts, and draft GitHub Release to `tauri-action`.
- The Release lives in the source repository. There is no cross-repository publishing,
  manual-dispatch mode, local publisher, resume protocol, or custom asset verifier.
- Publishing the generated draft remains a deliberate final maintainer action so an
  incomplete build never becomes the updater's `latest` release.

## Acceptance

- A tag that does not match the Tauri version fails before signing.
- A valid tag produces a signed DMG, updater archive, signature, and `latest.json` in
  one draft GitHub Release.
- The workflow has no repository-owned release orchestration script.
