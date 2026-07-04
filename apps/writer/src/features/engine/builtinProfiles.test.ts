import { describe, expect, it } from "vitest";
import {
  createBuiltinProfiles,
  EMPTY_BLOCK_MARKER,
} from "./builtinProfiles";

describe("built-in engine profiles", () => {
  it("exposes professional markdown profiles in the expected order", () => {
    expect(createBuiltinProfiles().map((profile) => profile.id)).toEqual([
      "commonmark",
      "gfm",
      "mdx",
      "blog-mdx",
    ]);
  });

  it("maps built-in insert templates to writer command ids", () => {
    const gfm = createBuiltinProfiles().find((profile) => profile.id === "gfm");

    expect(gfm?.commands?.map((command) => command.id)).toContain("editor.insert.table");
  });

  it("exposes the complete GFM writing-block command set", () => {
    const gfm = createBuiltinProfiles().find((profile) => profile.id === "gfm");

    expect(getInsertCommandIds(gfm)).toEqual([
      "paragraph",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "bullet",
      "number",
      "checklist",
      "quote",
      "table",
      "divider",
      "footnote",
      "code",
      "code-typescript",
      "code-tsx",
      "code-javascript",
      "code-rust",
      "code-json",
      "code-bash",
      "code-markdown",
      "code-plaintext",
      "link",
      "image",
    ]);
    expect(gfm?.commands?.every((command) => command.group)).toBe(true);
    expect(gfm?.commands?.map((command) => command.id)).toContain(
      "editor.insert.footnote",
    );
  });

  it("keeps CommonMark free of GFM, frontmatter, and MDX-only commands", () => {
    const commonmark = createBuiltinProfiles().find(
      (profile) => profile.id === "commonmark",
    );

    const commandIds = getInsertCommandIds(commonmark);

    expect(commandIds).toContain("quote");
    expect(commandIds).not.toContain("table");
    expect(commandIds).not.toContain("checklist");
    expect(commandIds).not.toContain("frontmatter");
    expect(commandIds).not.toContain("callout");
    expect(commonmark?.commands?.map((command) => command.id)).not.toContain(
      "editor.insert.callout",
    );
  });

  it("puts MDX callouts in MDX profiles and blog frontmatter in the blog profile", () => {
    const profiles = createBuiltinProfiles();
    const mdx = profiles.find((profile) => profile.id === "mdx");
    const blogMdx = profiles.find((profile) => profile.id === "blog-mdx");

    expect(getInsertCommandIds(mdx)).toContain("callout");
    expect(getInsertCommandIds(mdx)).not.toContain("frontmatter");
    expect(getInsertCommandIds(blogMdx)).toContain("frontmatter");
    expect(getInsertCommandIds(blogMdx)).toContain("callout-warning");
  });

  it("adds command palette metadata to built-in insert commands", () => {
    const blogMdx = createBuiltinProfiles().find(
      (profile) => profile.id === "blog-mdx",
    );
    const frontmatter = blogMdx?.commands?.find(
      (command) => command.id === "editor.insert.frontmatter",
    );

    expect(blogMdx?.commands?.every((command) => command.group === "Insert")).toBe(
      true,
    );
    expect(blogMdx?.commands?.every((command) => command.scope === "insert")).toBe(
      true,
    );
    expect(blogMdx?.commands?.every((command) => (command.priority ?? 0) > 0)).toBe(
      true,
    );
    expect(frontmatter?.keywords).toEqual(
      expect.arrayContaining(["Blocks", "YAML metadata block", "yaml"]),
    );
  });

  it("exposes CodeMirror editor profile extensions", () => {
    const profiles = createBuiltinProfiles();

    expect(profiles.map((profile) => profile.editorExtensions?.[0])).toEqual([
      { kind: "markdown-editor-profile", syntax: "commonmark" },
      { kind: "markdown-editor-profile", syntax: "gfm" },
      { kind: "markdown-editor-profile", syntax: "mdx" },
      { kind: "markdown-editor-profile", syntax: "blog-mdx" },
    ]);
  });

  it("inserts visible selected placeholders for insert commands", async () => {
    const blogMdx = createBuiltinProfiles().find(
      (profile) => profile.id === "blog-mdx",
    );
    const inserted: string[] = [];
    const editor = {
      insertMarkdown: (markdown: string) => {
        inserted.push(markdown);
      },
    };

    await blogMdx?.commands
      ?.find((command) => command.id === "editor.insert.paragraph")
      ?.run({ document: null, editor });
    await blogMdx?.commands
      ?.find((command) => command.id === "editor.insert.h3")
      ?.run({ document: null, editor });

    expect(inserted[0]).toBe(
      `${EMPTY_BLOCK_MARKER}Text${EMPTY_BLOCK_MARKER}\n`,
    );
    expect(inserted[1]).toBe(
      `### ${EMPTY_BLOCK_MARKER}Heading 3${EMPTY_BLOCK_MARKER}\n\n`,
    );
  });
});

function getInsertCommandIds(
  profile: ReturnType<typeof createBuiltinProfiles>[number] | undefined,
): string[] {
  return (
    profile?.commands?.map((command) =>
      command.id.replace("editor.insert.", ""),
    ) ?? []
  );
}
