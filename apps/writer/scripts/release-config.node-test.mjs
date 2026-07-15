import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildReleaseBody,
  decideSourceTag,
  decideTargetRelease,
  extractLatestChangelogSection,
  loadReleaseConfig,
  parseCargoVersion,
  parseUpdaterEndpoint,
  releaseMarker,
  validateReleaseAssets,
} from "./release-config.mjs";

void test("release config uses Tauri version and updater endpoint as authorities", () => {
  const writerDir = fs.mkdtempSync(path.join(os.tmpdir(), "writer-release-"));
  fs.mkdirSync(path.join(writerDir, "src-tauri"));
  fs.writeFileSync(
    path.join(writerDir, "src-tauri/tauri.conf.json"),
    JSON.stringify({
      productName: "Writer",
      version: "1.2.3",
      plugins: {
        updater: {
          endpoints: ["https://github.com/example/writer/releases/latest/download/latest.json"],
        },
      },
    }),
  );
  fs.writeFileSync(path.join(writerDir, "package.json"), JSON.stringify({ version: "1.2.3" }));
  fs.writeFileSync(
    path.join(writerDir, "src-tauri/Cargo.toml"),
    '[package]\nname = "desktop"\nversion = "1.2.3"\n\n[dependencies]\n',
  );
  fs.writeFileSync(
    path.join(writerDir, "CHANGELOG.md"),
    "# Changelog\n\n## 2026-07-16\n\n- New release.\n\n## 2026-07-01\n\n- Old.\n",
  );

  assert.deepEqual(loadReleaseConfig(writerDir), {
    version: "1.2.3",
    tag: "v1.2.3",
    productName: "Writer",
    releaseRepo: { owner: "example", repo: "writer" },
    defaultNotes: "- New release.",
  });
});

void test("metadata parsers reject drift and unsupported updater URLs", () => {
  assert.equal(parseCargoVersion('[package]\nname = "x"\nversion = "2.0.0"\n'), "2.0.0");
  assert.deepEqual(
    parseUpdaterEndpoint("https://github.com/acme/writer/releases/latest/download/latest.json"),
    { owner: "acme", repo: "writer" },
  );
  assert.throws(
    () => parseUpdaterEndpoint("https://example.com/latest.json"),
    /GitHub latest\.json release URL/,
  );
  assert.equal(
    extractLatestChangelogSection(
      "# Changelog\n\n## 2026-07-16\n\n- First.\n\n- Second.\n\n## 2026-07-01\n\n- Old.\n",
    ),
    "- First.\n\n- Second.",
  );
});

void test("release body carries machine and human readable provenance", () => {
  const body = buildReleaseBody({
    notes: "- Better releases.",
    sourceRepo: "acme/source",
    sourceSha: "1234567890abcdef",
    publisher: "github-actions",
    runUrl: "https://github.com/acme/source/actions/runs/42",
  });
  assert.match(body, /source=acme\/source@1234567890abcdef; publisher=github-actions/);
  assert.match(body, /commit\/1234567890abcdef/);
  assert.match(body, /actions\/runs\/42/);
  assert.match(body, /Better releases/);
});

void test("target release state table only resumes the same Actions-owned draft", () => {
  const expectedMarker = releaseMarker({
    sourceRepo: "acme/source",
    sourceSha: "abc123",
    publisher: "github-actions",
  });
  assert.deepEqual(
    decideTargetRelease({
      matchingReleases: [],
      targetTagExists: false,
      expectedMarker,
    }),
    { action: "claim" },
  );
  const draft = { id: 7, draft: true, body: `${expectedMarker}\nnotes` };
  assert.deepEqual(
    decideTargetRelease({
      matchingReleases: [draft],
      targetTagExists: true,
      expectedMarker,
    }),
    { action: "resume", release: draft },
  );

  const failures = [
    {
      matchingReleases: [],
      targetTagExists: true,
      message: /tag exists without a release/,
    },
    {
      matchingReleases: [{ draft: false, body: expectedMarker }],
      targetTagExists: true,
      message: /already published/,
    },
    {
      matchingReleases: [{ draft: true, body: "publisher=local" }],
      targetTagExists: true,
      message: /unmanaged, local-owned/,
    },
    {
      matchingReleases: [draft, draft],
      targetTagExists: true,
      message: /Multiple target releases/,
    },
  ];
  for (const fixture of failures) {
    assert.throws(() => decideTargetRelease({ ...fixture, expectedMarker }), fixture.message);
  }
});

void test("source tag compare-and-create rejects retargeting", () => {
  assert.equal(decideSourceTag({ existingSha: undefined, expectedSha: "abc" }), "create");
  assert.equal(decideSourceTag({ existingSha: "abc", expectedSha: "abc" }), "keep");
  assert.throws(
    () => decideSourceTag({ existingSha: "old", expectedSha: "new" }),
    /points to old, expected new/,
  );
});

function validAssetFixture() {
  const marker = releaseMarker({
    sourceRepo: "acme/source",
    sourceSha: "abc123",
    publisher: "github-actions",
  });
  const archive = { id: 2, name: "Writer.app.tar.gz", size: 200 };
  const url = "https://api.github.com/repos/acme/writer/releases/assets/2";
  return {
    release: { draft: true, body: marker },
    assets: [
      { id: 1, name: "Writer_1.2.3_aarch64.dmg", size: 100 },
      archive,
      { id: 3, name: "Writer.app.tar.gz.sig", size: 20 },
      { id: 4, name: "latest.json", size: 50 },
    ],
    manifest: {
      version: "1.2.3",
      platforms: {
        "darwin-aarch64": { signature: "signed", url },
        "darwin-aarch64-app": { signature: "signed", url },
      },
    },
    signature: "signed\n",
    version: "1.2.3",
    owner: "acme",
    repo: "writer",
    tag: "v1.2.3",
    expectedMarker: marker,
  };
}

void test("updater asset verification checks content, not only filenames", () => {
  const fixture = validAssetFixture();
  assert.deepEqual(validateReleaseAssets(fixture), {
    archiveName: "Writer.app.tar.gz",
    platforms: ["darwin-aarch64", "darwin-aarch64-app"],
  });

  const invalidFixtures = [
    {
      ...fixture,
      release: { ...fixture.release, draft: false },
      message: /only accepts a draft/,
    },
    {
      ...fixture,
      manifest: { ...fixture.manifest, version: "9.9.9" },
      message: /version does not match/,
    },
    {
      ...fixture,
      signature: "different",
      message: /signature does not match/,
    },
    {
      ...fixture,
      assets: fixture.assets.map((asset) =>
        asset.name === "latest.json" ? { ...asset, size: 0 } : asset,
      ),
      message: /latest\.json is empty/,
    },
    {
      ...fixture,
      manifest: {
        ...fixture.manifest,
        platforms: {
          ...fixture.manifest.platforms,
          "darwin-x86_64": { signature: "signed", url: "unexpected" },
        },
      },
      message: /Unexpected updater platforms/,
    },
  ];
  for (const invalid of invalidFixtures) {
    assert.throws(() => validateReleaseAssets(invalid), invalid.message);
  }
});
