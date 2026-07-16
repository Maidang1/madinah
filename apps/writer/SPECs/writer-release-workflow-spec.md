# Writer release workflow

## Goal

Ship the Apple Silicon macOS app through one understandable path.

## Design

- `src-tauri/tauri.conf.json` is the release version authority.
- A matching `v<version>` tag pushed to `Maidang1/madinah` is the only trigger.
- GitHub Actions uses ad-hoc macOS signing and delegates the DMG build and draft GitHub
  Release to `tauri-action`; no Apple certificate, notarization account, or updater key
  is required.
- The Release lives in the source repository. There is no cross-repository publishing,
  manual-dispatch mode, local publisher, resume protocol, or custom asset verifier.
- Publishing the generated draft remains a deliberate final maintainer action.
- Writer has no in-app updater; users install newer versions manually from GitHub
  Releases.

## Acceptance

- A tag that does not match the Tauri version fails before signing.
- A valid tag produces an ad-hoc-signed DMG in one draft GitHub Release.
- The workflow has no repository-owned release orchestration script.
