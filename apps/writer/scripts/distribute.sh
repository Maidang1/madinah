#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"
RELEASE_CONFIG_SCRIPT="$SCRIPT_DIR/release-config.mjs"

NOTES_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --notes-file)
      NOTES_FILE="$2"
      shift 2
      ;;
    --notes-file=*)
      NOTES_FILE="${1#*=}"
      shift
      ;;
    *)
      echo "Error: unknown argument: $1"
      echo "Usage: $0 --notes-file <path>"
      exit 1
      ;;
  esac
done

if [ -z "$NOTES_FILE" ]; then
  echo "Error: --notes-file <path> is required"
  echo "Pass a markdown file with the user-facing release notes (drafted by the agent from CHANGELOG.md)."
  exit 1
fi
if [ ! -s "$NOTES_FILE" ]; then
  echo "Error: notes file is missing or empty: $NOTES_FILE"
  exit 1
fi
NOTES_FILE="$(cd "$(dirname "$NOTES_FILE")" && pwd)/$(basename "$NOTES_FILE")"

# Load environment variables
if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  echo ""
  echo "Create it with:"
  echo "  APPLE_SIGNING_IDENTITY=\"Developer ID Application: Your Name (TEAMID)\""
  echo "  APPLE_ID=\"your@apple.id\""
  echo "  APPLE_PASSWORD=\"xxxx-xxxx-xxxx-xxxx\"  # app-specific password"
  echo "  APPLE_TEAM_ID=\"XXXXXXXXXX\""
  echo "  TAURI_SIGNING_PRIVATE_KEY=\"/absolute/path/to/writer-updater-key\""
  echo "  TAURI_SIGNING_PRIVATE_KEY_PASSWORD=\"\"  # empty if keypair has no password"
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

for var in APPLE_SIGNING_IDENTITY APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID TAURI_SIGNING_PRIVATE_KEY; do
  if [ -z "${!var:-}" ]; then
    echo "Error: $var is not set in .env"
    exit 1
  fi
done

# `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is optional but tauri-cli checks the env
# var is present — export an empty default so the build doesn't fail on macOS.
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"

# Resolve the same validated version and target repository used by CI.
RELEASE_METADATA=$(node "$RELEASE_CONFIG_SCRIPT" local-metadata)
VERSION=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).version)' "$RELEASE_METADATA")
TAG=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).tag)' "$RELEASE_METADATA")
RELEASE_OWNER=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).releaseRepo.owner)' "$RELEASE_METADATA")
RELEASE_NAME=$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).releaseRepo.repo)' "$RELEASE_METADATA")
RELEASE_REPO="$RELEASE_OWNER/$RELEASE_NAME"
SOURCE_REPO=$(gh repo view --json nameWithOwner --jq '.nameWithOwner')
SOURCE_DEFAULT_BRANCH=$(gh repo view "$SOURCE_REPO" --json defaultBranchRef --jq '.defaultBranchRef.name')
TARGET_DEFAULT_BRANCH=$(gh repo view "$RELEASE_REPO" --json defaultBranchRef --jq '.defaultBranchRef.name')

# Pre-flight: must be on the default branch, clean, in sync with origin, and the tag must
# not already exist anywhere. These checks are cheap — fail before the long
# release build rather than after.
CURRENT_BRANCH=$(git -C "$ROOT_DIR" rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "$SOURCE_DEFAULT_BRANCH" ]; then
  echo "Error: releases must be cut from $SOURCE_DEFAULT_BRANCH, currently on '$CURRENT_BRANCH'"
  exit 1
fi

if [ -n "$(git -C "$ROOT_DIR" status --porcelain --untracked-files=normal)" ]; then
  echo "Error: working tree has uncommitted changes — commit the version bump first"
  git -C "$ROOT_DIR" status --short
  exit 1
fi

echo "Fetching origin to verify sync..."
git -C "$ROOT_DIR" fetch origin "$SOURCE_DEFAULT_BRANCH" --tags

LOCAL_REV=$(git -C "$ROOT_DIR" rev-parse HEAD)
REMOTE_REV=$(git -C "$ROOT_DIR" rev-parse "origin/$SOURCE_DEFAULT_BRANCH")
BASE_REV=$(git -C "$ROOT_DIR" merge-base HEAD "origin/$SOURCE_DEFAULT_BRANCH")
if [ "$LOCAL_REV" != "$REMOTE_REV" ] && [ "$BASE_REV" != "$REMOTE_REV" ]; then
  echo "Error: local $SOURCE_DEFAULT_BRANCH is not a fast-forward of origin/$SOURCE_DEFAULT_BRANCH"
  echo "  local:  $LOCAL_REV"
  echo "  origin: $REMOTE_REV"
  echo "  Pull or rebase before releasing."
  exit 1
fi

if git -C "$ROOT_DIR" rev-parse --verify --quiet "refs/tags/$TAG" >/dev/null; then
  echo "Error: tag $TAG already exists locally — bump the version or delete the tag"
  exit 1
fi
if git -C "$ROOT_DIR" ls-remote --tags --exit-code origin "refs/tags/$TAG" >/dev/null 2>&1; then
  echo "Error: tag $TAG already exists on origin — bump the version"
  exit 1
fi

TARGET_RELEASES=$(gh api --paginate --method GET \
  "repos/$RELEASE_REPO/releases?per_page=100" \
  --jq ".[] | select(.tag_name == \"$TAG\") | .id")
if [ -n "$TARGET_RELEASES" ]; then
  echo "Error: release $TAG already exists on $RELEASE_REPO"
  echo "The local fallback is create-only and will not modify an existing draft or published release."
  exit 1
fi
TARGET_TAGS=$(gh api "repos/$RELEASE_REPO/git/matching-refs/tags/$TAG" \
  --jq "[.[] | select(.ref == \"refs/tags/$TAG\")] | length")
if [ "$TARGET_TAGS" -ne 0 ]; then
  echo "Error: tag $TAG already exists on $RELEASE_REPO without a visible release"
  exit 1
fi

# Push the default branch so the commit the release points at is on origin before we build.
# Idempotent if local already matches origin.
echo "Pushing $SOURCE_DEFAULT_BRANCH to origin..."
git -C "$ROOT_DIR" push origin "$SOURCE_DEFAULT_BRANCH"

echo "Building Writer $TAG..."

# Build signed and notarized DMG + updater artifacts (.app.tar.gz + .sig).
cd "$ROOT_DIR"
BUILD_MARKER=$(mktemp)
RELEASE_BODY_FILE=$(mktemp)
cleanup() {
  rm -f "$BUILD_MARKER" "$RELEASE_BODY_FILE"
}
trap cleanup EXIT

node "$RELEASE_CONFIG_SCRIPT" local-body \
  --notes-file "$NOTES_FILE" \
  --output "$RELEASE_BODY_FILE" \
  --source-repo "$SOURCE_REPO" \
  --source-sha "$LOCAL_REV"

pnpm tauri build --bundles app,dmg

BUNDLE_DIR="$ROOT_DIR/src-tauri/target/release/bundle"
DMG_DIR="$BUNDLE_DIR/dmg"
MACOS_DIR="$BUNDLE_DIR/macos"

find_fresh_artifact() {
  directory="$1"
  pattern="$2"
  description="$3"
  matches=$(find "$directory" -type f -name "$pattern" -newer "$BUILD_MARKER" -print 2>/dev/null || true)
  count=$(printf '%s\n' "$matches" | awk 'NF { count += 1 } END { print count + 0 }')
  if [ "$count" -ne 1 ]; then
    echo "Error: expected one fresh $description in $directory, found $count" >&2
    return 1
  fi
  printf '%s' "$matches"
}

DMG_FILE=$(find_fresh_artifact "$DMG_DIR" '*.dmg' 'DMG')
TAR_FILE=$(find_fresh_artifact "$MACOS_DIR" '*.app.tar.gz' 'updater archive')
SIG_FILE=$(find_fresh_artifact "$MACOS_DIR" '*.app.tar.gz.sig' 'updater signature')

echo ""
echo "Built: $(basename "$DMG_FILE") ($(du -h "$DMG_FILE" | cut -f1))"
echo "Built: $(basename "$TAR_FILE") ($(du -h "$TAR_FILE" | cut -f1))"
echo "Built: $(basename "$SIG_FILE") ($(du -h "$SIG_FILE" | cut -f1))"

# Determine target triple for latest.json (arm64 host → aarch64).
HOST_ARCH=$(uname -m)
case "$HOST_ARCH" in
  arm64|aarch64) TARGET="darwin-aarch64" ;;
  *) echo "Error: Writer releases currently require an arm64 Mac, found $HOST_ARCH"; exit 1 ;;
esac

SIGNATURE=$(cat "$SIG_FILE")
TAR_NAME=$(basename "$TAR_FILE")
PUB_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
DOWNLOAD_URL="https://github.com/$RELEASE_REPO/releases/download/$TAG/$TAR_NAME"

LATEST_JSON="$BUNDLE_DIR/latest.json"
python3 - "$LATEST_JSON" "$VERSION" "$NOTES_FILE" "$PUB_DATE" "$TARGET" "$SIGNATURE" "$DOWNLOAD_URL" <<'PY'
import json, sys
out_path, version, notes_file, pub_date, target, signature, url = sys.argv[1:]
with open(notes_file) as f:
    notes = f.read().strip()
platform = {
    "signature": signature,
    "url": url,
}
payload = {
    "version": version,
    "notes": notes,
    "pub_date": pub_date,
    "platforms": {
        target: platform,
        f"{target}-app": platform,
    },
}
with open(out_path, "w") as f:
    json.dump(payload, f, indent=2)
PY

echo "Built: latest.json ($TARGET)"

node "$RELEASE_CONFIG_SCRIPT" verify-local \
  --source-repo "$SOURCE_REPO" \
  --source-sha "$LOCAL_REV" \
  --release-body "$RELEASE_BODY_FILE" \
  --dmg "$DMG_FILE" \
  --archive "$TAR_FILE" \
  --signature "$SIG_FILE" \
  --manifest "$LATEST_JSON"

# Atomically claim the target tag with a local-owned draft. If Actions claimed
# it while this build was running, GitHub rejects this create instead of letting
# the two publishers overwrite each other's assets.
echo ""
echo "Creating draft release $TAG on $RELEASE_REPO..."

gh release create "$TAG" "$DMG_FILE" "$TAR_FILE" "$SIG_FILE" "$LATEST_JSON" \
  --repo "$RELEASE_REPO" \
  --target "$TARGET_DEFAULT_BRANCH" \
  --title "Writer $TAG" \
  --notes-file "$RELEASE_BODY_FILE" \
  --draft

DRAFT_URL=$(gh release view "$TAG" --repo "$RELEASE_REPO" --json url --jq '.url')

# Tag this repo so the release artifact is pinned to a specific commit. If you
# end up abandoning the draft, delete the tag manually.
echo ""
echo "Tagging $TAG locally and pushing to origin..."
git -C "$ROOT_DIR" tag "$TAG"
git -C "$ROOT_DIR" push origin "$TAG"

echo ""
echo "Draft created: $DRAFT_URL"
echo "Review the notes and click Publish to ship it."
