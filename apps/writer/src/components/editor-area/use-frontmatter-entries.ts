import { useCallback, useRef, useState } from "react";
import { useFrontmatter } from "@/hooks/use-frontmatter";
import {
  makeEntryId,
  parseYamlEntries,
  serializeYamlEntries,
  type YamlEntry,
} from "@/lib/yaml-entries";

export interface FrontmatterEntryUpdateOptions {
  isComplex?: boolean;
}

// State machine for frontmatter rows:
//   - A row is either "placeholder" (key === "" && value === "") or "committed".
//   - When frontmatter exists but has no committed entries, show one placeholder.
//   - A placeholder row focuses its key input on mount (via a ref callback).
//   - On blur, a row whose key is still empty is removed.
//   - When the last row is removed, the whole frontmatter block is removed.

function makeEmptyRow(): YamlEntry {
  return { id: makeEntryId(), key: "", value: "", isComplex: false };
}

function seedOrParse(frontmatter: string | null): YamlEntry[] {
  if (frontmatter === null) return [];
  const parsed = parseYamlEntries(frontmatter);
  return parsed.length > 0 ? parsed : [makeEmptyRow()];
}

function focusActiveEditor() {
  requestAnimationFrame(() => {
    const active =
      document.querySelector<HTMLElement>(".tiptap-editor-host .ProseMirror-focused") ??
      document.querySelector<HTMLElement>(".tiptap-editor-host .ProseMirror");
    active?.focus();
  });
}

export function useFrontmatterEntries(filePath: string) {
  const { frontmatter, hasFrontmatter, updateFrontmatter, removeFrontmatter } =
    useFrontmatter(filePath);
  // `useFrontmatter` normalizes `null` → `""` for rendering convenience, so we
  // recover the null-vs-empty distinction here.
  const rawFrontmatter = hasFrontmatter ? frontmatter : null;

  const [localEntries, setLocalEntries] = useState<YamlEntry[]>(() => seedOrParse(rawFrontmatter));
  const lastFrontmatterRef = useRef<string | null>(rawFrontmatter);

  // Sync from the store when the stored YAML changes (disk reload, programmatic
  // edit, or our own commit). We pin `lastFrontmatterRef` inside `commit` to the
  // exact string we pushed, so this branch never triggers after our own writes.
  if (rawFrontmatter !== lastFrontmatterRef.current) {
    lastFrontmatterRef.current = rawFrontmatter;
    setLocalEntries(seedOrParse(rawFrontmatter));
  }

  const commit = useCallback(
    (next: YamlEntry[]) => {
      setLocalEntries(next);
      if (next.length === 0) {
        lastFrontmatterRef.current = null;
        removeFrontmatter();
        focusActiveEditor();
        return;
      }
      const yaml = serializeYamlEntries(next);
      lastFrontmatterRef.current = yaml;
      updateFrontmatter(yaml);
    },
    [updateFrontmatter, removeFrontmatter],
  );

  const updateEntry = useCallback(
    (
      index: number,
      field: "key" | "value",
      value: string,
      options: FrontmatterEntryUpdateOptions = {},
    ) => {
      commit(
        localEntries.map((entry, i) => {
          if (i !== index) return entry;
          const next: YamlEntry = { ...entry, [field]: value };
          if (options.isComplex !== undefined) {
            next.isComplex = options.isComplex;
          }
          return next;
        }),
      );
    },
    [localEntries, commit],
  );

  const removeEntry = useCallback(
    (index: number) => {
      commit(localEntries.filter((_, i) => i !== index));
    },
    [localEntries, commit],
  );

  // Add a placeholder row. Local-only — the empty key prevents it from being
  // serialized into the store until the user types something.
  const addEntry = useCallback(() => {
    setLocalEntries((prev) => [...prev, makeEmptyRow()]);
  }, []);

  const createFrontmatter = useCallback(() => {
    const row = makeEmptyRow();
    lastFrontmatterRef.current = "";
    setLocalEntries([row]);
    updateFrontmatter("");
  }, [updateFrontmatter]);

  // On blur, reap rows whose key is still empty. The caller is expected to
  // filter out blurs that stayed within the same row (e.g., Tab from key to
  // value) — see `FrontmatterPanel`.
  const blurEntry = useCallback(
    (index: number) => {
      const row = localEntries[index];
      if (!row || row.key.trim() !== "") return;
      commit(localEntries.filter((_, i) => i !== index));
    },
    [localEntries, commit],
  );

  return {
    entries: localEntries,
    updateEntry,
    removeEntry,
    addEntry,
    createFrontmatter,
    blurEntry,
    removeFrontmatter,
    hasFrontmatter,
  };
}
