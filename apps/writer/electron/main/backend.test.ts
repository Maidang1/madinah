import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAcpAgentArgs,
  buildAcpActionPrompt,
  buildAcpPolishPrompt,
  buildAssetObjectKey,
  checkAssetUploadSettings,
  createFileTreeDirectory,
  createFileTreeFile,
  defaultAssetUploadSettings,
  duplicateFileTreeFile,
  exportPathForSlug,
  getAcpMediumThinkingConfigRequests,
  listFileTree,
  moveFileTreePathToTrash,
  normalizeAcpActionText,
  normalizeAcpTimeout,
  normalizeAssetUploadSettings,
  parseAiDocumentReview,
  parseAiMetadataSuggestion,
  renameFileTreePath,
  resolveWorkspace,
  resolveWorkspacePluginsFromRootWithTrust,
  saveAssetUploadSettingsToFile,
  setPluginTrustInFile,
  uploadAssetImage,
} from "./backend";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Electron backend file tree", () => {
  it("lists only markdown files and visible directories", async () => {
    const temp = await tempDir();
    const root = temp.path;

    await mkdir(path.join(root, "docs", "nested"), { recursive: true });
    await mkdir(path.join(root, ".git"), { recursive: true });
    await mkdir(path.join(root, "node_modules"), { recursive: true });
    await mkdir(path.join(root, ".madinah-writer", "trash"), {
      recursive: true,
    });
    await mkdir(path.join(root, ".hidden"), { recursive: true });
    await writeFile(path.join(root, "readme.md"), "# Readme");
    await writeFile(path.join(root, "draft.markdown"), "# Draft");
    await writeFile(path.join(root, "docs", "intro.mdx"), "# Intro");
    await writeFile(path.join(root, "docs", "notes.txt"), "ignored");
    await writeFile(path.join(root, ".git", "config.md"), "ignored");
    await writeFile(path.join(root, "node_modules", "pkg.md"), "ignored");
    await writeFile(
      path.join(root, ".madinah-writer", "trash", "old.md"),
      "ignored",
    );
    await writeFile(path.join(root, ".hidden", "secret.md"), "ignored");

    const tree = await listFileTree(root);

    expect(tree.map((entry) => entry.name)).toEqual([
      "docs",
      "draft.markdown",
      "readme.md",
    ]);
    const docs = tree.find((entry) => entry.name === "docs");
    expect(docs?.childrenCount).toBe(2);
    expect(docs?.children.map((entry) => entry.name)).toEqual([
      "nested",
      "intro.mdx",
    ]);
  });

  it("creates, renames, duplicates, and moves markdown files to trash", async () => {
    const temp = await tempDir();
    const root = temp.path;

    const created = await createFileTreeFile(root, "New Note.md");
    expect(created.source).toBe("# New Note\n\n");

    await expect(createFileTreeFile(root, "../escape.md")).rejects.toThrow(
      "Invalid file name",
    );

    const renamed = await renameFileTreePath(
      path.join(root, "New Note.md"),
      "Renamed.md",
    );
    expect(renamed.name).toBe("Renamed.md");
    expect(existsSync(path.join(root, "Renamed.md"))).toBe(true);

    await writeFile(path.join(root, "Renamed copy.md"), "existing");
    const duplicated = await duplicateFileTreeFile(path.join(root, "Renamed.md"));
    expect(duplicated.path).toBe(path.join(root, "Renamed copy 2.md"));
    expect(duplicated.source).toBe("# New Note\n\n");

    const trashPath = await moveFileTreePathToTrash(
      root,
      path.join(root, "Renamed.md"),
    );
    expect(existsSync(path.join(root, "Renamed.md"))).toBe(false);
    expect(trashPath).toContain(`${CONFIG_SEGMENT}trash`);
    expect(await readFile(trashPath, "utf8")).toBe("# New Note\n\n");
  });

  it("creates directories and rejects duplicates", async () => {
    const temp = await tempDir();
    const root = temp.path;

    const created = await createFileTreeDirectory(root, "Guides");
    expect(created.name).toBe("Guides");
    expect(created.kind).toBe("directory");
    expect(existsSync(path.join(root, "Guides"))).toBe(true);

    await expect(createFileTreeDirectory(root, "Guides")).rejects.toThrow(
      "already exists",
    );
    await expect(createFileTreeDirectory(root, "../escape")).rejects.toThrow(
      "Invalid file name",
    );
  });
});

describe("Electron backend workspace plugins", () => {
  it("resolves workspace config before package.json", async () => {
    const temp = await tempDir();
    const workspace = path.join(temp.path, "project", "docs");
    await mkdir(path.join(workspace, ".madinah-writer"), { recursive: true });
    await writeFile(
      path.join(workspace, ".madinah-writer", "config.json"),
      JSON.stringify({
        schemaVersion: 1,
        profile: "mdx-compatible",
        plugins: ["./plugins/callouts"],
      }),
    );
    await writeFile(path.join(temp.path, "project", "package.json"), "{}");
    const file = path.join(workspace, "note.md");
    await writeFile(file, "# Note");

    const info = await resolveWorkspace(file);

    expect(info.root).toBe(workspace);
    expect(info.profile).toBe("mdx-compatible");
    expect(info.plugins).toEqual(["./plugins/callouts"]);
  });

  it("resolves plugin manifests and refreshes trust when bundles change", async () => {
    const temp = await tempDir();
    const workspace = temp.path;
    await writeWorkspacePlugin(workspace, "export default { version: 1 };\n");
    const trustPath = path.join(workspace, ".madinah-writer", "trust.json");

    const initial = await resolveWorkspacePluginsFromRootWithTrust(
      workspace,
      trustPath,
    );
    expect(initial).toHaveLength(1);
    expect(initial[0]).toMatchObject({
      id: "local-callouts",
      version: "1.2.3",
      capabilities: ["remark", "previewComponents"],
      trusted: false,
    });
    expect(initial[0].bundleHash).toHaveLength(64);

    await setPluginTrustInFile(trustPath, {
      workspaceRoot: workspace,
      packageId: "local-callouts",
      version: "1.2.3",
      bundleHash: initial[0].bundleHash,
      trusted: true,
    });

    const trusted = await resolveWorkspacePluginsFromRootWithTrust(
      workspace,
      trustPath,
    );
    expect(trusted[0].trusted).toBe(true);

    await writeFile(
      path.join(workspace, "plugins", "callouts", "dist", "browser.mjs"),
      "export default { version: 2 };\n",
    );

    const refreshed = await resolveWorkspacePluginsFromRootWithTrust(
      workspace,
      trustPath,
    );
    expect(refreshed[0].trusted).toBe(false);
    expect(refreshed[0].bundleHash).not.toBe(initial[0].bundleHash);
  });
});

describe("Electron backend assets and blog paths", () => {
  it("normalizes asset settings and masks saved secrets", async () => {
    const temp = await tempDir();
    const settingsPath = path.join(temp.path, "asset-upload.json");
    const normalized = normalizeAssetUploadSettings({
      endpoint: " https://upload.example.com/ ",
      apiKey: " key ",
      publicBaseUrl: "https://assets.example.com/",
      prefix: "/images/writer/",
      maxBytes: 10,
    });

    expect(normalized).toMatchObject({
      schemaVersion: 2,
      provider: "cloudflare-r2-worker",
      endpoint: "https://upload.example.com",
      apiKey: "key",
      publicBaseUrl: "https://assets.example.com",
      prefix: "images/writer",
      maxBytes: 1024,
    });

    const saved = await saveAssetUploadSettingsToFile(settingsPath, {
      ...normalized,
      maxBytes: 2048,
    });
    expect(saved.apiKey).toBe("********");
    expect(JSON.parse(await readFile(settingsPath, "utf8")).apiKey).toBe("key");
  });

  it("migrates legacy R2 settings without preserving provider secrets", () => {
    const normalized = normalizeAssetUploadSettings({
      accountId: "abc",
      bucket: "madinah-assets",
      accessKeyId: "access",
      secretAccessKey: "secret",
      publicBaseUrl: "https://assets.example.com/",
      prefix: "/images/legacy/",
    });

    expect(normalized).toMatchObject({
      endpoint: "",
      apiKey: "",
      publicBaseUrl: "https://assets.example.com",
      prefix: "images/legacy",
    });
  });

  it("checks the configured worker endpoint with the API key", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      checkAssetUploadSettings(
        { userDataDir: (await tempDir()).path },
        {
          ...defaultAssetUploadSettings(),
          endpoint: "https://upload.example.com/",
          apiKey: "key",
        },
      ),
    ).resolves.toEqual({ ok: true, message: "Connected" });

    expect(fetchMock).toHaveBeenCalledWith("https://upload.example.com/health", {
      headers: {
        "x-api-key": "key",
      },
    });
  });

  it("uploads images through the configured worker endpoint", async () => {
    const temp = await tempDir();
    const settingsPath = path.join(temp.path, "asset-upload.json");
    await saveAssetUploadSettingsToFile(settingsPath, {
      ...defaultAssetUploadSettings(),
      endpoint: "https://upload.example.com",
      apiKey: "key",
      publicBaseUrl: "https://assets.example.com",
      prefix: "images/writer",
    });
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("done"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await uploadAssetImage(
      { userDataDir: temp.path },
      {
        name: "Hello World!.png",
        contentType: "image/png",
        size: 4,
        dataBase64: "AQIDBA==",
      },
    );

    expect(result.key).toMatch(
      /^images\/writer\/\d{4}\/\d{2}\/[a-f0-9]{12}-hello-world\.png$/u,
    );
    expect(result.url).toBe(`https://assets.example.com/${result.key}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `https://upload.example.com/${result.key
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/")}`,
    );
    expect(init).toMatchObject({
      method: "PUT",
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": "image/png",
        "x-api-key": "key",
      },
    });
    expect(init?.body).toBeInstanceOf(Uint8Array);
  });

  it("builds stable asset object keys and rejects slug traversal", () => {
    const key = buildAssetObjectKey(
      "images/writer",
      "Hello World!.png",
      "image/png",
      Buffer.from("image"),
      2026,
      7,
    );

    expect(key).toMatch(
      /^images\/writer\/2026\/07\/[a-f0-9]{12}-hello-world\.png$/u,
    );
    expect(() => exportPathForSlug("/tmp/blogs", "../escape")).toThrow(
      "Invalid slug",
    );
  });
});

describe("Electron backend ACP helpers", () => {
  it("builds ACP args, prompt, and timeout defaults", () => {
    expect(
      buildAcpAgentArgs('npx -y "@agentclientprotocol/codex-acp"', [
        {
          name: "CODEX_PATH",
          value: "/usr/local/bin/codex",
        },
      ]),
    ).toEqual([
      "CODEX_PATH=/usr/local/bin/codex",
      "npx",
      "-y",
      "@agentclientprotocol/codex-acp",
    ]);

    expect(() =>
      buildAcpAgentArgs("npx -y @agentclientprotocol/codex-acp", [
        {
          name: "1_BAD",
          value: "x",
        },
      ]),
    ).toThrow("Invalid environment variable");

    const prompt = buildAcpPolishPrompt("# Title\n\nBody", "Make it clear.");
    expect(prompt).toContain("Make it clear.");
    expect(prompt).toContain("Return only the polished Markdown body.");
    expect(prompt).toContain("MADINAH_WRITER_RESULT_START");
    expect(prompt).toContain("MADINAH_WRITER_RESULT_END");
    expect(prompt).toContain(
      "<<<MADINAH_WRITER_BODY\n# Title\n\nBody\nMADINAH_WRITER_BODY",
    );
    expect(normalizeAcpTimeout(0)).toBe(120);
    expect(normalizeAcpTimeout(900)).toBe(600);
  });

  it("builds action-specific prompts for selection, metadata, and review", () => {
    expect(
      buildAcpActionPrompt({
        kind: "rewrite-selection",
        content: "rough text",
        instruction: "Keep it direct.",
      }),
    ).toContain("Selected Markdown:\n<<<MADINAH_WRITER_SELECTION\nrough text");

    const metadataPrompt = buildAcpActionPrompt({
      kind: "generate-metadata",
      content: "# Title\n\nBody",
      instruction: "",
    });
    expect(metadataPrompt).toContain('"title": "string"');
    expect(metadataPrompt).toContain("Return only valid JSON");
    expect(metadataPrompt).toContain("MADINAH_WRITER_RESULT_START");

    const reviewPrompt = buildAcpActionPrompt({
      kind: "review-document",
      content: "# Title\n\nBody",
      instruction: "",
    });
    expect(reviewPrompt).toContain('"severity": "info | warning | critical"');
  });

  it("normalizes fenced output and parses metadata JSON", () => {
    expect(normalizeAcpActionText("```json\n{\"title\":\"A\"}\n```")).toBe(
      '{"title":"A"}',
    );
    expect(
      normalizeAcpActionText(
        [
          "Warning: Skill descriptions were shortened to fit the 2% skills context budget. Codex can still see every skill, but some descriptions are shorter.",
          "MADINAH_WRITER_RESULT_START",
          "```markdown",
          "# Polished",
          "",
          "Better body.",
          "```",
          "MADINAH_WRITER_RESULT_END",
        ].join("\n"),
      ),
    ).toBe("# Polished\n\nBetter body.");
    expect(
      normalizeAcpActionText(
        "Warning: Skill descriptions were shortened to fit the 2% skills context budget. Codex can still see every skill, but some descriptions are shorter.",
      ),
    ).toBe("");
    expect(
      parseAiMetadataSuggestion(
        "```json\n{\"title\":\"Madinah AI\",\"description\":\"Useful.\",\"tags\":[\"AI\",\"writer\",\"AI\"],\"slug\":\"Madinah AI\"}\n```",
      ),
    ).toEqual({
      title: "Madinah AI",
      description: "Useful.",
      tags: ["ai", "writer"],
      slug: "madinah-ai",
    });
    expect(() => parseAiMetadataSuggestion("not json")).toThrow(
      "invalid metadata suggestion JSON",
    );
  });

  it("builds medium thinking config requests for Codex and Claude ACP options", () => {
    expect(
      getAcpMediumThinkingConfigRequests([
        {
          id: "reasoning_effort",
          currentValue: "xhigh",
          options: [
            { value: "low" },
            { value: "medium" },
            { value: "high" },
          ],
        },
        {
          id: "effort",
          currentValue: "default",
          options: [
            { value: "default" },
            { value: "medium" },
          ],
        },
        {
          id: "model",
          currentValue: "gpt-5.5",
          options: [{ value: "gpt-5.5" }],
        },
      ]),
    ).toEqual([
      { configId: "reasoning_effort", value: "medium" },
      { configId: "effort", value: "medium" },
    ]);
  });

  it("skips medium thinking requests when the option is already medium or unsupported", () => {
    expect(
      getAcpMediumThinkingConfigRequests([
        {
          id: "reasoning_effort",
          currentValue: "medium",
          options: [{ value: "medium" }],
        },
        {
          id: "effort",
          currentValue: "default",
          options: [{ value: "default" }],
        },
      ]),
    ).toEqual([]);
  });

  it("parses document review JSON with safe severities", () => {
    expect(
      parseAiDocumentReview(
        JSON.stringify({
          summary: "Good article.",
          issues: [
            {
              severity: "critical",
              title: "Missing claim",
              detail: "The opening lacks a claim.",
              suggestion: "Add one concrete claim.",
            },
            {
              severity: "unknown",
              title: "Tone",
              detail: "",
              suggestion: "Keep the voice consistent.",
            },
          ],
        }),
      ),
    ).toEqual({
      summary: "Good article.",
      issues: [
        {
          severity: "critical",
          title: "Missing claim",
          detail: "The opening lacks a claim.",
          suggestion: "Add one concrete claim.",
        },
        {
          severity: "info",
          title: "Tone",
          detail: "",
          suggestion: "Keep the voice consistent.",
        },
      ],
    });
  });
});

const CONFIG_SEGMENT = `${path.sep}.madinah-writer${path.sep}`;

async function tempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "madinah-writer-"));
  return {
    path: dir,
  };
}

async function writeWorkspacePlugin(workspace: string, bundle: string) {
  await mkdir(path.join(workspace, ".madinah-writer"), { recursive: true });
  await writeFile(
    path.join(workspace, ".madinah-writer", "config.json"),
    JSON.stringify({
      schemaVersion: 1,
      profile: "gfm",
      plugins: ["./plugins/callouts"],
    }),
  );

  const plugin = path.join(workspace, "plugins", "callouts");
  await mkdir(path.join(plugin, "dist"), { recursive: true });
  await writeFile(
    path.join(plugin, "package.json"),
    JSON.stringify({
      name: "local-callouts",
      version: "1.2.3",
      madinahWriter: {
        apiVersion: 1,
        entry: "./dist/browser.mjs",
        capabilities: ["remark", "previewComponents"],
      },
    }),
  );
  await writeFile(path.join(plugin, "dist", "browser.mjs"), bundle);
}
