import { parse, stringify } from "yaml";
import { BLOG_POST_STATUS_OPTIONS, type BlogPostStatus } from "@madinah-shared/blog-frontmatter";
import type { YamlEntry } from "./yaml-entries";

export const FRONTMATTER_STATUS_OPTIONS = BLOG_POST_STATUS_OPTIONS;

export type FrontmatterStatus = BlogPostStatus;

export interface MadinahFrontmatter {
  title?: string;
  author?: string;
  description?: string;
  tags?: string[];
  slug?: string;
  pubDate?: string;
  status?: FrontmatterStatus;
}

export type FrontmatterControl =
  | { kind: "text" }
  | { kind: "textarea" }
  | { kind: "tags" }
  | { kind: "datetime" }
  | { kind: "select"; options: readonly string[] };

export interface FrontmatterFieldDefinition {
  key: string;
  control: FrontmatterControl;
}

export interface FrontmatterValuePatch {
  value: string;
  isComplex: boolean;
}

const FRONTMATTER_FIELD_DEFINITIONS: Record<keyof MadinahFrontmatter, FrontmatterFieldDefinition> =
  {
    title: { key: "title", control: { kind: "text" } },
    author: { key: "author", control: { kind: "text" } },
    description: { key: "description", control: { kind: "textarea" } },
    tags: { key: "tags", control: { kind: "tags" } },
    slug: { key: "slug", control: { kind: "text" } },
    pubDate: { key: "pubDate", control: { kind: "datetime" } },
    status: { key: "status", control: { kind: "select", options: FRONTMATTER_STATUS_OPTIONS } },
  };

export function getFrontmatterFieldDefinition(key: string): FrontmatterFieldDefinition {
  return (
    FRONTMATTER_FIELD_DEFINITIONS[key as keyof MadinahFrontmatter] ?? {
      key,
      control: { kind: "text" },
    }
  );
}

export function formatFrontmatterControlValue(entry: YamlEntry): string {
  const definition = getFrontmatterFieldDefinition(entry.key);

  if (definition.control.kind === "tags") {
    return parseTagsValue(entry.value, entry.isComplex).join(", ");
  }

  if (definition.control.kind === "datetime") {
    return formatDateTimeLocalValue(entry.value);
  }

  return entry.value;
}

export function parseFrontmatterControlValue(key: string, rawValue: string): FrontmatterValuePatch {
  const definition = getFrontmatterFieldDefinition(key);

  if (definition.control.kind === "tags") {
    const tags = splitTagsInput(rawValue);
    return {
      value: stringify(tags, { lineWidth: 0 }).trim(),
      isComplex: true,
    };
  }

  if (definition.control.kind === "datetime") {
    return { value: parseDateTimeLocalValue(rawValue), isComplex: false };
  }

  return { value: rawValue, isComplex: false };
}

export function getSelectOptionsWithCurrentValue(
  options: readonly string[],
  currentValue: string,
): readonly string[] {
  if (currentValue === "" || options.includes(currentValue)) return options;
  return [currentValue, ...options];
}

function parseTagsValue(value: string, isComplex: boolean): string[] {
  const trimmed = value.trim();
  if (trimmed === "") return [];

  if (isComplex || trimmed.startsWith("[") || trimmed.startsWith("-") || trimmed.includes("\n")) {
    try {
      const parsed: unknown = parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter((item) => item !== "");
      }
    } catch {
      // Fall back to lightweight splitting below.
    }
  }

  return splitTagsInput(value);
}

function splitTagsInput(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((item) => item.replace(/^-\s*/, "").trim())
    .filter((item) => item !== "");
}

function formatDateTimeLocalValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") return "";

  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2})(?::(\d{2}))?)?/);
  if (!match) return "";

  const [, date, time = "00:00", seconds] = match;
  return `${date}T${time}${seconds ? `:${seconds}` : ""}`;
}

function parseDateTimeLocalValue(value: string): string {
  return value.trim().replace("T", " ");
}
