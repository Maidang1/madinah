#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WRITER_DIR = path.resolve(SCRIPT_DIR, "..");
const GITHUB_API = "https://api.github.com";

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function parseCargoVersion(cargoToml) {
  const packageSection = cargoToml.match(/^\[package\]\s*$([\s\S]*?)(?=^\[|(?![\s\S]))/m)?.[1];
  return packageSection?.match(/^version\s*=\s*"([^"]+)"\s*$/m)?.[1];
}

export function parseUpdaterEndpoint(endpoint) {
  const match = endpoint.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/releases\/latest\/download\/latest\.json$/,
  );
  invariant(match, `Updater endpoint must be a GitHub latest.json release URL: ${endpoint}`);
  return { owner: match[1], repo: match[2] };
}

export function extractLatestChangelogSection(changelog) {
  const match = changelog.match(/^## \d{4}-\d{2}-\d{2}\s*$\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
  invariant(match?.[1]?.trim(), "CHANGELOG.md has no dated release notes.");
  return match[1].trim();
}

export function loadReleaseConfig(writerDir = DEFAULT_WRITER_DIR) {
  const tauriConf = JSON.parse(
    fs.readFileSync(path.join(writerDir, "src-tauri/tauri.conf.json"), "utf8"),
  );
  const packageJson = JSON.parse(fs.readFileSync(path.join(writerDir, "package.json"), "utf8"));
  const cargoVersion = parseCargoVersion(
    fs.readFileSync(path.join(writerDir, "src-tauri/Cargo.toml"), "utf8"),
  );
  const changelog = fs.readFileSync(path.join(writerDir, "CHANGELOG.md"), "utf8");
  const version = tauriConf.version;

  invariant(typeof version === "string" && version, "Missing Tauri version.");
  invariant(
    packageJson.version === version && cargoVersion === version,
    `Version mismatch: tauri=${version}, package=${packageJson.version}, cargo=${cargoVersion}`,
  );

  const endpoints = tauriConf.plugins?.updater?.endpoints;
  invariant(
    Array.isArray(endpoints) && endpoints.length === 1,
    "Writer must configure exactly one updater endpoint.",
  );
  const releaseRepo = parseUpdaterEndpoint(endpoints[0]);

  return {
    version,
    tag: `v${version}`,
    productName: tauriConf.productName,
    releaseRepo,
    defaultNotes: extractLatestChangelogSection(changelog),
  };
}

export function releaseMarker({ sourceRepo, sourceSha, publisher }) {
  invariant(sourceRepo && sourceSha && publisher, "Incomplete release provenance.");
  return `<!-- writer-release: source=${sourceRepo}@${sourceSha}; publisher=${publisher} -->`;
}

export function buildReleaseBody({ notes, sourceRepo, sourceSha, publisher, runUrl }) {
  const marker = releaseMarker({ sourceRepo, sourceSha, publisher });
  const sourceUrl = `https://github.com/${sourceRepo}/commit/${sourceSha}`;
  const provenance = [
    `Built from [\`${sourceRepo}@${sourceSha.slice(0, 12)}\`](${sourceUrl}).`,
    runUrl ? `[GitHub Actions run](${runUrl}).` : "Published by the local fallback.",
  ].join(" ");
  return `${marker}\n\n${provenance}\n\n${notes.trim()}\n`;
}

export function decideTargetRelease({ matchingReleases, targetTagExists, expectedMarker }) {
  invariant(
    matchingReleases.length <= 1,
    "Multiple target releases use the same tag; refusing to choose one.",
  );
  const release = matchingReleases[0];
  if (!release) {
    invariant(!targetTagExists, "Target tag exists without a release; refusing to take ownership.");
    return { action: "claim" };
  }
  invariant(release.draft, "The target release is already published.");
  invariant(
    release.body?.includes(expectedMarker),
    "The existing draft is unmanaged, local-owned, or belongs to another source commit.",
  );
  return { action: "resume", release };
}

export function decideSourceTag({ existingSha, expectedSha }) {
  if (!existingSha) {
    return "create";
  }
  invariant(
    existingSha === expectedSha,
    `Source tag points to ${existingSha}, expected ${expectedSha}.`,
  );
  return "keep";
}

function selectSingleAsset(assets, predicate, description) {
  const matches = assets.filter((asset) => predicate(asset.name));
  invariant(matches.length === 1, `Expected one ${description}, found ${matches.length}.`);
  invariant(matches[0].size > 0, `${matches[0].name} is empty.`);
  return matches[0];
}

export function validateReleaseAssets({
  release,
  assets,
  manifest,
  signature,
  version,
  owner,
  repo,
  tag,
  expectedMarker,
}) {
  invariant(release.draft, "Asset verification only accepts a draft release.");
  invariant(
    release.body?.includes(expectedMarker),
    "Draft provenance changed before asset verification.",
  );
  invariant(
    new Set(assets.map((asset) => asset.name)).size === assets.length,
    "Release assets contain duplicate names.",
  );
  invariant(assets.length === 4, `Expected four release assets, found ${assets.length}.`);

  selectSingleAsset(assets, (name) => name.endsWith(".dmg"), "DMG");
  const archive = selectSingleAsset(
    assets,
    (name) => name.endsWith(".app.tar.gz"),
    "updater archive",
  );
  selectSingleAsset(assets, (name) => name.endsWith(".app.tar.gz.sig"), "updater signature");
  selectSingleAsset(assets, (name) => name === "latest.json", "latest.json");

  invariant(manifest.version === version, "latest.json version does not match Writer.");
  const platformKeys = Object.keys(manifest.platforms ?? {}).sort();
  invariant(
    JSON.stringify(platformKeys) === JSON.stringify(["darwin-aarch64", "darwin-aarch64-app"]),
    `Unexpected updater platforms: ${platformKeys.join(", ") || "none"}.`,
  );

  const acceptedUrls = new Set([
    `${GITHUB_API}/repos/${owner}/${repo}/releases/assets/${archive.id}`,
    `https://github.com/${owner}/${repo}/releases/download/${tag}/${archive.name}`,
  ]);
  for (const key of platformKeys) {
    const platform = manifest.platforms[key];
    invariant(
      platform.signature.trim() === signature.trim(),
      `${key} signature does not match the uploaded .sig asset.`,
    );
    invariant(
      acceptedUrls.has(platform.url),
      `${key} URL does not point to the uploaded updater archive.`,
    );
  }
  return { archiveName: archive.name, platforms: platformKeys };
}

function appendGitHubOutputs(values) {
  invariant(process.env.GITHUB_OUTPUT, "GITHUB_OUTPUT is not set.");
  let content = "";
  for (const [key, rawValue] of Object.entries(values)) {
    const value = String(rawValue);
    if (value.includes("\n")) {
      const delimiter = `writer_${crypto.randomUUID()}`;
      content += `${key}<<${delimiter}\n${value}\n${delimiter}\n`;
    } else {
      content += `${key}=${value}\n`;
    }
  }
  fs.appendFileSync(process.env.GITHUB_OUTPUT, content);
}

function readEvent() {
  invariant(process.env.GITHUB_EVENT_PATH, "GITHUB_EVENT_PATH is not set.");
  return JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
}

function resolveCiMetadata() {
  const config = loadReleaseConfig();
  const event = readEvent();
  const eventName = process.env.GITHUB_EVENT_NAME;
  const sourceRepo = process.env.GITHUB_REPOSITORY;
  const sourceSha = process.env.GITHUB_SHA;
  const ref = process.env.GITHUB_REF;
  const sourceDefaultBranch = event.repository?.default_branch;
  invariant(sourceRepo && sourceSha && ref, "Incomplete GitHub event context.");
  invariant(sourceDefaultBranch, "Cannot resolve the source default branch.");

  if (eventName === "push") {
    invariant(
      ref === `refs/tags/${config.tag}`,
      `Release ref ${ref} must match refs/tags/${config.tag}.`,
    );
  } else if (eventName === "workflow_dispatch") {
    invariant(
      ref === `refs/heads/${sourceDefaultBranch}` || ref === `refs/tags/${config.tag}`,
      `Manual releases must run from ${sourceDefaultBranch} or ${config.tag}.`,
    );
  } else {
    throw new Error(`Unsupported release event: ${eventName}`);
  }

  const notes = process.env.RELEASE_NOTES?.trim() || config.defaultNotes;
  const runUrl = `https://github.com/${sourceRepo}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  const releaseBody = buildReleaseBody({
    notes,
    sourceRepo,
    sourceSha,
    publisher: "github-actions",
    runUrl,
  });
  return {
    ...config,
    sourceRepo,
    sourceSha,
    sourceDefaultBranch,
    releaseBody,
    releaseNotes: notes,
  };
}

async function githubRequest(apiPath, { token, method = "GET", body, raw = false }) {
  invariant(token, "GitHub release token is missing.");
  const request = {
    method,
    headers: {
      Accept: raw ? "application/octet-stream" : "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "writer-release-ci",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
  };
  if (body) {
    request.body = JSON.stringify(body);
  }
  const response = await fetch(`${GITHUB_API}${apiPath}`, request);
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(
      `GitHub API ${method} ${apiPath} failed (${response.status}): ${detail}`,
    );
    error.status = response.status;
    throw error;
  }
  return raw ? Buffer.from(await response.arrayBuffer()) : response.json();
}

async function githubRequestOrMissing(apiPath, options) {
  try {
    return await githubRequest(apiPath, options);
  } catch (error) {
    if (error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

async function listAllReleases({ owner, repo, token }) {
  const releases = [];
  for (let page = 1; ; page += 1) {
    const batch = await githubRequest(
      `/repos/${owner}/${repo}/releases?per_page=100&page=${page}`,
      { token },
    );
    releases.push(...batch);
    if (batch.length < 100) {
      return releases;
    }
  }
}

async function claimTargetRelease() {
  const config = resolveCiMetadata();
  const token = process.env.WRITER_RELEASE_TOKEN;
  const { owner, repo } = config.releaseRepo;
  const targetRepo = await githubRequest(`/repos/${owner}/${repo}`, { token });
  invariant(targetRepo.default_branch, "Target repository has no default branch.");

  const releases = await listAllReleases({ owner, repo, token });
  const matchingReleases = releases.filter((release) => release.tag_name === config.tag);
  const targetRef = await githubRequestOrMissing(
    `/repos/${owner}/${repo}/git/ref/tags/${encodeURIComponent(config.tag)}`,
    { token },
  );
  const marker = releaseMarker({
    sourceRepo: config.sourceRepo,
    sourceSha: config.sourceSha,
    publisher: "github-actions",
  });
  const decision = decideTargetRelease({
    matchingReleases,
    targetTagExists: Boolean(targetRef),
    expectedMarker: marker,
  });

  let release = decision.release;
  if (decision.action === "claim") {
    release = await githubRequest(`/repos/${owner}/${repo}/releases`, {
      token,
      method: "POST",
      body: {
        tag_name: config.tag,
        target_commitish: targetRepo.default_branch,
        name: `Writer ${config.tag}`,
        body: config.releaseBody,
        draft: true,
        prerelease: false,
      },
    });
  }

  appendGitHubOutputs({
    release_id: release.id,
    release_url: release.html_url,
    release_state: decision.action,
    target_default_branch: targetRepo.default_branch,
  });
}

async function verifyCiRelease() {
  const config = resolveCiMetadata();
  const token = process.env.WRITER_RELEASE_TOKEN;
  const releaseId = process.env.RELEASE_ID;
  invariant(releaseId, "RELEASE_ID is missing.");
  const { owner, repo } = config.releaseRepo;
  const release = await githubRequest(`/repos/${owner}/${repo}/releases/${releaseId}`, { token });
  const assets = await githubRequest(
    `/repos/${owner}/${repo}/releases/${releaseId}/assets?per_page=100`,
    { token },
  );
  const manifestAsset = assets.find((asset) => asset.name === "latest.json");
  const signatureAsset = assets.find((asset) => asset.name.endsWith(".app.tar.gz.sig"));
  invariant(manifestAsset && signatureAsset, "Updater assets are incomplete.");
  const [manifestBytes, signatureBytes] = await Promise.all([
    githubRequest(`/repos/${owner}/${repo}/releases/assets/${manifestAsset.id}`, {
      token,
      raw: true,
    }),
    githubRequest(`/repos/${owner}/${repo}/releases/assets/${signatureAsset.id}`, {
      token,
      raw: true,
    }),
  ]);
  const marker = releaseMarker({
    sourceRepo: config.sourceRepo,
    sourceSha: config.sourceSha,
    publisher: "github-actions",
  });
  const result = validateReleaseAssets({
    release,
    assets,
    manifest: JSON.parse(manifestBytes.toString("utf8")),
    signature: signatureBytes.toString("utf8"),
    version: config.version,
    owner,
    repo,
    tag: config.tag,
    expectedMarker: marker,
  });
  appendGitHubOutputs({
    archive_name: result.archiveName,
    platforms: result.platforms.join(", "),
  });
}

function writeLocalBody(args) {
  const notesFile = args.get("--notes-file");
  const output = args.get("--output");
  const sourceRepo = args.get("--source-repo");
  const sourceSha = args.get("--source-sha");
  invariant(notesFile && output, "local-body requires --notes-file and --output.");
  const notes = fs.readFileSync(notesFile, "utf8");
  invariant(notes.trim(), `Release notes are empty: ${notesFile}`);
  fs.writeFileSync(
    output,
    buildReleaseBody({
      notes,
      sourceRepo,
      sourceSha,
      publisher: "local",
    }),
  );
}

function verifyLocalArtifacts(args) {
  const config = loadReleaseConfig();
  const sourceRepo = args.get("--source-repo");
  const sourceSha = args.get("--source-sha");
  const releaseBodyFile = args.get("--release-body");
  const dmgPath = args.get("--dmg");
  const archivePath = args.get("--archive");
  const signaturePath = args.get("--signature");
  const manifestPath = args.get("--manifest");
  invariant(
    sourceRepo &&
      sourceSha &&
      releaseBodyFile &&
      dmgPath &&
      archivePath &&
      signaturePath &&
      manifestPath,
    "verify-local requires provenance and all four artifact paths.",
  );
  const paths = [dmgPath, archivePath, signaturePath, manifestPath];
  const assets = paths.map((assetPath, index) => ({
    id: index + 1,
    name: path.basename(assetPath),
    size: fs.statSync(assetPath).size,
  }));
  const marker = releaseMarker({ sourceRepo, sourceSha, publisher: "local" });
  validateReleaseAssets({
    release: {
      draft: true,
      body: fs.readFileSync(releaseBodyFile, "utf8"),
    },
    assets,
    manifest: JSON.parse(fs.readFileSync(manifestPath, "utf8")),
    signature: fs.readFileSync(signaturePath, "utf8"),
    version: config.version,
    owner: config.releaseRepo.owner,
    repo: config.releaseRepo.repo,
    tag: config.tag,
    expectedMarker: marker,
  });
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    args.set(argv[index], argv[index + 1]);
  }
  return args;
}

async function main() {
  const command = process.argv[2];
  if (command === "metadata") {
    const config = resolveCiMetadata();
    appendGitHubOutputs({
      version: config.version,
      tag: config.tag,
      owner: config.releaseRepo.owner,
      repo: config.releaseRepo.repo,
      release_name: `Writer ${config.tag}`,
      release_body: config.releaseBody,
      release_notes: config.releaseNotes,
      source_default_branch: config.sourceDefaultBranch,
    });
  } else if (command === "claim") {
    await claimTargetRelease();
  } else if (command === "verify") {
    await verifyCiRelease();
  } else if (command === "local-metadata") {
    process.stdout.write(`${JSON.stringify(loadReleaseConfig())}\n`);
  } else if (command === "local-body") {
    writeLocalBody(parseArgs(process.argv.slice(3)));
  } else if (command === "verify-local") {
    verifyLocalArtifacts(parseArgs(process.argv.slice(3)));
  } else if (command) {
    throw new Error(`Unknown release-config command: ${command}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
