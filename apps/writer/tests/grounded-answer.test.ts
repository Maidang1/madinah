import { describe, expect, test } from "vite-plus/test";
import {
  buildKnowledgePrompt,
  classifyCitationPath,
  extractCitationCandidates,
  parseCitationReference,
  projectGroundedAnswer,
  validateCitation,
  type GroundingDeps,
} from "../src/lib/grounded-answer";

function memoryDeps(files: Record<string, string>): GroundingDeps {
  const normalized = new Map(
    Object.entries(files).map(([path, content]) => [path.replace(/\\/g, "/"), content]),
  );
  return {
    fileExists: (absolutePath) => normalized.has(absolutePath.replace(/\\/g, "/")),
    readFile: (absolutePath) => {
      const content = normalized.get(absolutePath.replace(/\\/g, "/"));
      if (content === undefined) throw new Error(`missing ${absolutePath}`);
      return content;
    },
  };
}

const ROOT = "/workspace";

describe("buildKnowledgePrompt", () => {
  test("requires Document-only answers and relative citations", () => {
    const prompt = buildKnowledgePrompt("What is our deploy process?");
    expect(prompt).toContain("Markdown/MDX Documents");
    expect(prompt).toContain("Workspace-relative path");
    expect(prompt).toContain("Sources");
    expect(prompt).toContain("What is our deploy process?");
    expect(prompt.indexOf("User message:")).toBeLessThan(
      prompt.indexOf("What is our deploy process?"),
    );
  });
});

describe("parseCitationReference", () => {
  test("parses relative path with optional heading anchor", () => {
    expect(parseCitationReference("notes/guide.md#setup")).toEqual({
      raw: "notes/guide.md#setup",
      relativePath: "notes/guide.md",
      anchor: "setup",
    });
  });

  test("parses paths with spaces via angle brackets and percent-encoding", () => {
    expect(parseCitationReference("<My Guide.mdx#intro>")).toEqual({
      raw: "<My Guide.mdx#intro>",
      relativePath: "My Guide.mdx",
      anchor: "intro",
    });
    expect(parseCitationReference("docs/My%20Guide.md")).toEqual({
      raw: "docs/My%20Guide.md",
      relativePath: "docs/My Guide.md",
    });
  });
});

describe("extractCitationCandidates", () => {
  test("extracts markdown links, backticks, and Sources lines without duplicates", () => {
    const text = [
      "Deploy uses the blue gate. See [guide](docs/deploy.md#blue-gate).",
      "Also `docs/deploy.md#blue-gate` and notes/other.md.",
      "",
      "Sources:",
      "- docs/deploy.md#blue-gate",
      "- notes/runbook.mdx",
      "- secrets.env",
    ].join("\n");

    const candidates = extractCitationCandidates(text);
    expect(candidates.map((c) => `${c.relativePath}#${c.anchor ?? ""}`)).toEqual([
      "docs/deploy.md#blue-gate",
      "notes/runbook.mdx#",
    ]);
  });

  test("ignores non-document prose and external URLs", () => {
    const text = "Visit https://example.com/a.md and read the README without an extension.";
    expect(extractCitationCandidates(text)).toEqual([]);
  });
});

describe("classifyCitationPath", () => {
  test("rejects traversal, absolute, and unsupported extensions", () => {
    expect(
      classifyCitationPath({ raw: "../outside.md", relativePath: "../outside.md" }, ROOT).ok,
    ).toBe(false);
    expect(
      classifyCitationPath({ raw: "../outside.md", relativePath: "../outside.md" }, ROOT),
    ).toMatchObject({ citation: { reason: "traversal" } });

    expect(
      classifyCitationPath({ raw: "/etc/passwd.md", relativePath: "/etc/passwd.md" }, ROOT),
    ).toMatchObject({ citation: { reason: "absolute" } });

    expect(
      classifyCitationPath({ raw: "notes/data.json", relativePath: "notes/data.json" }, ROOT),
    ).toMatchObject({ citation: { reason: "unsupported-extension" } });
  });

  test("accepts nested relative markdown paths", () => {
    expect(classifyCitationPath({ raw: "a/b.md", relativePath: "a/b.md" }, ROOT)).toEqual({
      ok: true,
      relativePath: "a/b.md",
      absolutePath: "/workspace/a/b.md",
    });
  });
});

describe("validateCitation", () => {
  const deps = memoryDeps({
    "/workspace/docs/deploy.md": ["# Deploy", "", "## Blue Gate", "Use blue.", ""].join("\n"),
    "/workspace/docs/My Guide.mdx": ["# My Guide", "", "## Intro", "Hello.", ""].join("\n"),
    "/workspace/notes/plain.markdown": "Just text without headings.\n",
  });

  test("accepts Markdown and MDX documents including paths with spaces", async () => {
    await expect(
      validateCitation({ raw: "docs/deploy.md", relativePath: "docs/deploy.md" }, ROOT, deps),
    ).resolves.toMatchObject({
      status: "valid",
      relativePath: "docs/deploy.md",
      absolutePath: "/workspace/docs/deploy.md",
    });

    await expect(
      validateCitation(
        {
          raw: "<docs/My Guide.mdx#intro>",
          relativePath: "docs/My Guide.mdx",
          anchor: "intro",
        },
        ROOT,
        deps,
      ),
    ).resolves.toMatchObject({
      status: "valid",
      relativePath: "docs/My Guide.mdx",
      anchor: "intro",
    });

    await expect(
      validateCitation(
        { raw: "notes/plain.markdown", relativePath: "notes/plain.markdown" },
        ROOT,
        deps,
      ),
    ).resolves.toMatchObject({ status: "valid" });
  });

  test("heading anchors are valid only when the target heading exists", async () => {
    await expect(
      validateCitation(
        {
          raw: "docs/deploy.md#blue-gate",
          relativePath: "docs/deploy.md",
          anchor: "blue-gate",
        },
        ROOT,
        deps,
      ),
    ).resolves.toMatchObject({ status: "valid", anchor: "blue-gate" });

    await expect(
      validateCitation(
        {
          raw: "docs/deploy.md#missing",
          relativePath: "docs/deploy.md",
          anchor: "missing",
        },
        ROOT,
        deps,
      ),
    ).resolves.toMatchObject({ status: "invalid", reason: "missing-heading" });
  });

  test("missing files and unsupported extensions are not evidence", async () => {
    await expect(
      validateCitation({ raw: "docs/missing.md", relativePath: "docs/missing.md" }, ROOT, deps),
    ).resolves.toMatchObject({ status: "invalid", reason: "missing-file" });

    await expect(
      validateCitation({ raw: "config.toml", relativePath: "config.toml" }, ROOT, deps),
    ).resolves.toMatchObject({ status: "invalid", reason: "unsupported-extension" });
  });
});

describe("projectGroundedAnswer", () => {
  const deps = memoryDeps({
    "/workspace/docs/deploy.md": "# Deploy\n\n## Blue Gate\nUse blue.\n",
    "/workspace/notes/runbook.mdx": "# Runbook\n",
  });

  test("marks answers with at least one valid citation Grounded", async () => {
    const projection = await projectGroundedAnswer(
      [
        "Use the blue gate.",
        "",
        "Sources:",
        "- docs/deploy.md#blue-gate",
        "- ../escape.md",
        "- notes/missing.md",
        "- secrets.env",
      ].join("\n"),
      ROOT,
      deps,
    );

    expect(projection.status).toBe("grounded");
    expect(projection.validCitations).toEqual([
      expect.objectContaining({
        status: "valid",
        relativePath: "docs/deploy.md",
        anchor: "blue-gate",
      }),
    ]);
    expect(projection.citations.filter((c) => c.status === "invalid").map((c) => c.reason)).toEqual(
      expect.arrayContaining(["traversal", "missing-file"]),
    );
  });

  test("marks answers with no valid reference Ungrounded while keeping content", async () => {
    const output = "The sky is blue. Sources:\n- /etc/hosts.md\n- data.json";
    const projection = await projectGroundedAnswer(output, ROOT, deps);
    expect(projection.status).toBe("ungrounded");
    expect(projection.validCitations).toEqual([]);
    expect(projection.citations.every((c) => c.status === "invalid")).toBe(true);
  });

  test("Ungrounded when the Agent invents citations that do not resolve", async () => {
    const projection = await projectGroundedAnswer(
      "Claim. See [x](notes/nope.md#ghost).",
      ROOT,
      deps,
    );
    expect(projection.status).toBe("ungrounded");
    expect(projection.citations[0]).toMatchObject({
      status: "invalid",
      reason: "missing-file",
    });
  });
});
