// Verifiable Grounded Answers (#13): extract Agent-emitted Workspace Document
// references, validate them against the live Workspace, and project
// Grounded vs Ungrounded status. No embeddings or second retrieval store.

import { hasMarkdownDocumentExtension } from "./document-extensions";
import { documentHasHeadingSlug } from "./document-headings";
import {
  decodeLinkPath,
  getRelativePath,
  normalizeMarkdownDestination,
  normalizePath,
} from "./paths";

const WINDOWS_ABSOLUTE = /^[A-Za-z]:[\\/]/;
const URL_SCHEME = /^[A-Za-z][A-Za-z\d+.-]*:/;

/**
 * Instructions prepended to every free-form temporary-conversation send in v1.
 * Knowledge-answer rules apply when the user is asking about Workspace content;
 * mutative edit/create/run requests remain allowed and are not citation-gated.
 */
export const KNOWLEDGE_PROMPT_INSTRUCTIONS = [
  "You are answering inside a Writer Workspace.",
  "When the user asks a knowledge question about Workspace content:",
  "- Search and answer only from Markdown/MDX Documents in this Workspace (.md, .mdx, .markdown).",
  "- Cite every supporting Document as a Workspace-relative path with an optional GFM heading slug anchor,",
  "  for example `notes/guide.md` or `docs/My Guide.mdx#setup`.",
  "- Prefer a final Sources section listing one relative reference per line, and/or Markdown links to those paths.",
  "- Other Workspace files may inform your reasoning but must never be cited as evidence.",
  "- If you cannot support the answer with Workspace Documents, say so; do not invent sources.",
  "When the user asks you to create, edit, reorganize, or otherwise change Workspace files (or run Agent tools),",
  "follow that request normally. Knowledge-citation rules apply to knowledge answers, not to mutative work.",
  "",
  "User message:",
].join("\n");

export function buildKnowledgePrompt(userPrompt: string): string {
  return `${KNOWLEDGE_PROMPT_INSTRUCTIONS}\n${userPrompt}`;
}

export type CitationInvalidReason =
  | "malformed"
  | "absolute"
  | "traversal"
  | "unsupported-extension"
  | "missing-file"
  | "missing-heading"
  | "outside-workspace";

export interface CitationCandidate {
  /** Raw token as it appeared in the Agent output. */
  raw: string;
  /** Relative path portion before any `#` anchor (may still be invalid). */
  relativePath: string;
  /** Optional heading slug from `#anchor`. */
  anchor?: string;
}

export type ValidatedCitation =
  | {
      status: "valid";
      raw: string;
      relativePath: string;
      absolutePath: string;
      anchor?: string;
    }
  | {
      status: "invalid";
      raw: string;
      relativePath?: string;
      absolutePath?: string;
      anchor?: string;
      reason: CitationInvalidReason;
    };

export type GroundingStatus = "grounded" | "ungrounded";

export interface GroundedAnswerProjection {
  status: GroundingStatus;
  citations: ValidatedCitation[];
  validCitations: Extract<ValidatedCitation, { status: "valid" }>[];
}

export interface GroundingDeps {
  fileExists: (absolutePath: string) => boolean | Promise<boolean>;
  readFile: (absolutePath: string) => string | Promise<string>;
}

/**
 * Parse a single reference token into path + optional anchor.
 * Accepts destinations like `notes/a.md`, `<My Guide.mdx#setup>`, `docs/a.md#intro`.
 */
export function parseCitationReference(raw: string): CitationCandidate | null {
  const normalized = normalizeMarkdownDestination(raw.trim());
  if (!normalized) return null;

  if (normalized.startsWith("#")) return null;

  const hashIndex = normalized.indexOf("#");
  const pathPart = hashIndex === -1 ? normalized : normalized.slice(0, hashIndex);
  const anchorPart = hashIndex === -1 ? "" : normalized.slice(hashIndex + 1);
  if (!pathPart) return null;

  let relativePath: string;
  try {
    relativePath = decodeLinkPath(pathPart);
  } catch {
    relativePath = pathPart;
  }
  relativePath = relativePath.replace(/\\/g, "/").replace(/^\.\//, "");

  let anchor: string | undefined;
  if (anchorPart) {
    try {
      anchor = decodeLinkPath(anchorPart);
    } catch {
      anchor = anchorPart;
    }
    if (!anchor) anchor = undefined;
  }

  return {
    raw: raw.trim(),
    relativePath,
    ...(anchor ? { anchor } : {}),
  };
}

/** Conservative extraction of citation-shaped tokens from Agent output. */
export function extractCitationCandidates(text: string): CitationCandidate[] {
  const seen = new Set<string>();
  const results: CitationCandidate[] = [];

  const push = (raw: string) => {
    const candidate = parseCitationReference(raw);
    if (!candidate) return;
    const key = `${candidate.relativePath}#${candidate.anchor ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(candidate);
  };

  // Markdown links: [label](dest), [label](<dest>), optional CommonMark titles
  const linkRe = /\[[^\]]*]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
  for (const match of text.matchAll(linkRe)) {
    const dest = match[1]!;
    if (looksLikeDocumentRef(dest)) push(dest);
  }

  // Backtick-wrapped paths
  const tickRe = /`([^`\n]+)`/g;
  for (const match of text.matchAll(tickRe)) {
    const inner = match[1]!;
    if (looksLikeDocumentRef(inner)) push(inner);
  }

  // Sources / References section: one relative ref per line after a heading
  const lines = text.split(/\r?\n/);
  let inSources = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      /^#{1,6}\s*(sources|references)\b/i.test(trimmed) ||
      /^(sources|references)\s*:?\s*$/i.test(trimmed)
    ) {
      inSources = true;
      continue;
    }
    if (inSources) {
      if (/^#{1,6}\s+\S/.test(trimmed)) {
        inSources = false;
        continue;
      }
      if (!trimmed) continue;
      // Strip leading list markers
      const item = trimmed.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "");
      // Prefer link dest if the line is a markdown link (optional title)
      const linkOnly =
        /^\[[^\]]*]\(\s*(<[^>\n]+>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)$/.exec(item);
      if (linkOnly) {
        push(linkOnly[1]!);
        continue;
      }
      if (looksLikeDocumentRef(item)) push(item);
    }
  }

  return results;
}

function looksLikeDocumentRef(raw: string): boolean {
  const candidate = parseCitationReference(raw);
  if (!candidate) return false;
  const path = candidate.relativePath;
  if (!path || path.includes("\n")) return false;
  if (URL_SCHEME.test(path) && !WINDOWS_ABSOLUTE.test(path)) return false;
  // Require a markdown-family extension so free prose is not harvested.
  return hasMarkdownDocumentExtension(path.split("#")[0] ?? path);
}

/**
 * Structural checks that do not touch the filesystem.
 * Returns an invalid citation or the normalized relative/absolute paths to verify.
 */
export function classifyCitationPath(
  candidate: CitationCandidate,
  workspaceRoot: string,
):
  | { ok: true; relativePath: string; absolutePath: string; anchor?: string }
  | { ok: false; citation: ValidatedCitation } {
  const { raw, relativePath, anchor } = candidate;

  if (!relativePath || relativePath.trim() === "") {
    return {
      ok: false,
      citation: { status: "invalid", raw, reason: "malformed" },
    };
  }

  // Evidence must be relative. Absolute POSIX/Windows paths are not evidence.
  if (
    relativePath.startsWith("/") ||
    WINDOWS_ABSOLUTE.test(relativePath) ||
    (URL_SCHEME.test(relativePath) && !WINDOWS_ABSOLUTE.test(relativePath))
  ) {
    return {
      ok: false,
      citation: {
        status: "invalid",
        raw,
        relativePath,
        ...(anchor ? { anchor } : {}),
        reason: "absolute",
      },
    };
  }

  // Reject any `..` segment (traversal attempts never count as evidence).
  const segments = relativePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (segments.some((part) => part === "..")) {
    return {
      ok: false,
      citation: {
        status: "invalid",
        raw,
        relativePath,
        ...(anchor ? { anchor } : {}),
        reason: "traversal",
      },
    };
  }

  if (!hasMarkdownDocumentExtension(relativePath)) {
    return {
      ok: false,
      citation: {
        status: "invalid",
        raw,
        relativePath,
        ...(anchor ? { anchor } : {}),
        reason: "unsupported-extension",
      },
    };
  }

  const root = normalizePath(workspaceRoot).replace(/\/$/, "");
  const absolutePath = normalizePath(`${root}/${relativePath.replace(/^\.\//, "")}`);

  if (absolutePath !== root && !absolutePath.startsWith(`${root}/`)) {
    return {
      ok: false,
      citation: {
        status: "invalid",
        raw,
        relativePath,
        absolutePath,
        ...(anchor ? { anchor } : {}),
        reason: "outside-workspace",
      },
    };
  }

  return {
    ok: true,
    relativePath: getRelativePath(absolutePath, root) || relativePath,
    absolutePath,
    ...(anchor ? { anchor } : {}),
  };
}

export async function validateCitation(
  candidate: CitationCandidate,
  workspaceRoot: string,
  deps: GroundingDeps,
): Promise<ValidatedCitation> {
  const classified = classifyCitationPath(candidate, workspaceRoot);
  if (!classified.ok) return classified.citation;

  const { relativePath, absolutePath, anchor } = classified;
  const { raw } = candidate;

  const exists = await deps.fileExists(absolutePath);
  if (!exists) {
    return {
      status: "invalid",
      raw,
      relativePath,
      absolutePath,
      ...(anchor ? { anchor } : {}),
      reason: "missing-file",
    };
  }

  if (anchor) {
    let content: string;
    try {
      content = await deps.readFile(absolutePath);
    } catch {
      return {
        status: "invalid",
        raw,
        relativePath,
        absolutePath,
        anchor,
        reason: "missing-file",
      };
    }
    if (!documentHasHeadingSlug(content, anchor)) {
      return {
        status: "invalid",
        raw,
        relativePath,
        absolutePath,
        anchor,
        reason: "missing-heading",
      };
    }
  }

  return {
    status: "valid",
    raw,
    relativePath,
    absolutePath,
    ...(anchor ? { anchor } : {}),
  };
}

export async function projectGroundedAnswer(
  agentOutput: string,
  workspaceRoot: string,
  deps: GroundingDeps,
): Promise<GroundedAnswerProjection> {
  const candidates = extractCitationCandidates(agentOutput);
  const citations: ValidatedCitation[] = [];
  for (const candidate of candidates) {
    citations.push(await validateCitation(candidate, workspaceRoot, deps));
  }
  const validCitations = citations.filter(
    (citation): citation is Extract<ValidatedCitation, { status: "valid" }> =>
      citation.status === "valid",
  );
  return {
    status: validCitations.length > 0 ? "grounded" : "ungrounded",
    citations,
    validCitations,
  };
}
