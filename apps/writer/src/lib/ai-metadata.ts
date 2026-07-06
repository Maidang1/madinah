import { parse, stringify } from "yaml";
import type { AiMetadataSuggestion } from "./tauri";

export function applyAiMetadataToFrontmatter(
  frontmatter: string | null,
  metadata: AiMetadataSuggestion,
): string {
  const record = parseFrontmatterRecord(frontmatter);
  record.title = metadata.title.trim();
  record.description = metadata.description.trim();
  record.tags = normalizeTags(metadata.tags);
  record.slug = metadata.slug.trim();
  return stringify(record, { lineWidth: 0 }).trim();
}

function parseFrontmatterRecord(frontmatter: string | null): Record<string, unknown> {
  if (frontmatter === null || frontmatter.trim() === "") return {};

  let parsed: unknown;
  try {
    parsed = parse(frontmatter);
  } catch {
    throw new Error("Frontmatter YAML is invalid");
  }

  if (!isPlainRecord(parsed)) {
    throw new Error("Frontmatter YAML must be an object");
  }

  return { ...parsed };
}

function normalizeTags(tags: string[]): string[] {
  const next: string[] = [];
  for (const tag of tags) {
    const normalized = String(tag).trim().toLowerCase();
    if (normalized && !next.includes(normalized)) next.push(normalized);
  }
  return next;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
