import type { ComponentType } from "react";
import { describe, expect, it } from "vitest";
import {
  mergeEngineProfiles,
  type EngineProfile,
  type WriterCommand,
} from "./engine";

const NullComponent = (() => null) as ComponentType<Record<string, unknown>>;

describe("engine profile merge", () => {
  it("merges built-in profile before workspace profile contributions", () => {
    const saveCommand: WriterCommand = {
      id: "document.save",
      label: "Save",
      run: () => undefined,
    };
    const exportCommand: WriterCommand = {
      id: "workspace.export",
      label: "Export",
      run: () => undefined,
    };

    const base: EngineProfile = {
      id: "gfm",
      name: "GitHub Flavored Markdown",
      remarkPlugins: ["remark-frontmatter", "remark-gfm"],
      rehypePlugins: ["rehype-slug"],
      editorPlugins: ["headings", "lists"],
      previewComponents: {
        Callout: NullComponent,
      },
      codeLanguages: [{ id: "typescript", label: "TypeScript" }],
      commands: [saveCommand],
    };
    const workspace: EngineProfile = {
      id: "workspace",
      name: "Workspace",
      remarkPlugins: ["remark-directive"],
      rehypePlugins: ["rehype-autolink-headings"],
      editorPlugins: ["callout-editor"],
      previewComponents: {
        Chart: NullComponent,
      },
      codeLanguages: [{ id: "rust", label: "Rust" }],
      commands: [exportCommand],
    };

    const merged = mergeEngineProfiles([base, workspace]);

    expect(merged.id).toBe("gfm+workspace");
    expect(merged.remarkPlugins).toEqual([
      "remark-frontmatter",
      "remark-gfm",
      "remark-directive",
    ]);
    expect(merged.rehypePlugins).toEqual([
      "rehype-slug",
      "rehype-autolink-headings",
    ]);
    expect(merged.editorPlugins).toEqual(["headings", "lists", "callout-editor"]);
    expect(Object.keys(merged.previewComponents ?? {})).toEqual(["Callout", "Chart"]);
    expect((merged.codeLanguages ?? []).map((language) => language.id)).toEqual([
      "typescript",
      "rust",
    ]);
    expect((merged.commands ?? []).map((command) => command.id)).toEqual([
      "document.save",
      "workspace.export",
    ]);
  });

  it("rejects duplicate command ids across merged profiles", () => {
    const duplicatedCommand: WriterCommand = {
      id: "document.save",
      label: "Save",
      run: () => undefined,
    };

    const makeProfile = (id: string): EngineProfile => ({
      id,
      name: id,
      commands: [duplicatedCommand],
    });

    expect(() => mergeEngineProfiles([makeProfile("base"), makeProfile("workspace")]))
      .toThrow("Duplicate command id: document.save");
  });
});
