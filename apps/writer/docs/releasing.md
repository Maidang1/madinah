# Releasing Writer

Writer has one release path: push a version tag and let GitHub Actions build a signed,
notarized Apple Silicon app. The workflow creates a draft Release in `Maidang1/madinah`;
a maintainer reviews the result and publishes it.

## Repository secrets

- `APPLE_CERTIFICATE`: base64-encoded Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD`: password for that certificate
- `KEYCHAIN_PASSWORD`: password used for the temporary CI keychain
- `APPLE_ID`: Apple ID email used for notarization
- `APPLE_PASSWORD`: Apple app-specific password
- `APPLE_TEAM_ID`: Apple Developer team ID
- `TAURI_SIGNING_PRIVATE_KEY`: private key used to sign updater artifacts
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: updater key password, or an empty value

The workflow uses the repository-provided `GITHUB_TOKEN`; no personal release token or
second release repository is involved. The updater private key must match the public key
configured in `src-tauri/tauri.conf.json`.

## Release

1. Update `version` in `src-tauri/tauri.conf.json` and add the user-visible changes to
   `CHANGELOG.md`.
2. Run the normal project checks, commit, and push the release commit.
3. Push the matching tag:

   ```sh
   git tag v<version>
   git push origin v<version>
   ```

4. Wait for **Writer Release** to finish. Open its draft Release, edit the notes if
   needed, confirm the DMG and updater assets are present, then click **Publish release**.
5. Confirm
   `https://github.com/Maidang1/madinah/releases/latest/download/latest.json` returns the
   new version.

The Tauri version is the release authority. `package.json` and `Cargo.toml` package
versions do not participate in the release tag or updater version.

## Failure behavior

- A tag that does not equal `v<tauri version>` stops before certificate import.
- A failed build leaves the release unpublished. Fix the cause and rerun the failed
  workflow; do not create a second tag for the same version.
- Never publish a draft without the DMG, updater archive, signature, and `latest.json`.
