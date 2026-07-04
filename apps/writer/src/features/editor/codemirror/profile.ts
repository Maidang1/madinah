export type MarkdownEditorMode = "rich-text" | "source";

export type MarkdownEditorSyntax = "commonmark" | "gfm" | "mdx" | "blog-mdx";

export interface MarkdownEditorProfileExtension {
  kind: "markdown-editor-profile";
  syntax: MarkdownEditorSyntax;
}

export function createMarkdownEditorProfileExtension(
  syntax: MarkdownEditorSyntax,
): MarkdownEditorProfileExtension {
  return {
    kind: "markdown-editor-profile",
    syntax,
  };
}

export function resolveMarkdownEditorSyntax(
  extensions: readonly unknown[],
): MarkdownEditorSyntax {
  for (let index = extensions.length - 1; index >= 0; index -= 1) {
    const extension = extensions[index];
    if (isMarkdownEditorProfileExtension(extension)) {
      return extension.syntax;
    }
  }
  return "gfm";
}

function isMarkdownEditorProfileExtension(
  extension: unknown,
): extension is MarkdownEditorProfileExtension {
  return (
    typeof extension === "object" &&
    extension !== null &&
    (extension as MarkdownEditorProfileExtension).kind ===
      "markdown-editor-profile"
  );
}
