# Releasing Writer

Writer has one release path: push a version tag and let GitHub Actions build an
ad-hoc-signed Apple Silicon DMG. The workflow creates a draft Release in
`Maidang1/madinah`; a maintainer reviews the result and publishes it.

The workflow uses the repository-provided `GITHUB_TOKEN`. It needs no custom Secrets,
Apple certificate, notarization account, or updater key. Because the app is not
notarized, macOS may require users to allow it manually in
**System Settings → Privacy & Security**.

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
   needed, confirm the DMG is present, then click **Publish release**.

Writer does not check for or install updates. Users download newer DMGs from GitHub
Releases and replace the installed app manually.

The Tauri version is the release authority. `package.json` and `Cargo.toml` package
versions do not participate in the release tag.

## Failure behavior

- A tag that does not equal `v<tauri version>` stops before the build.
- A failed build leaves the release unpublished. Fix the cause and rerun the failed
  workflow; do not create a second tag for the same version.
- Never publish a draft without a non-empty DMG.
