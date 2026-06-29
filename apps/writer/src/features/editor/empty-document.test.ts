import { describe, expect, it } from "vitest";
import editorSource from "./MarkdownEditor.tsx?raw";
import legacyEditorSource from "../../components/LiveMdxEditor.tsx?raw";
import {
  composeDocumentEditorMarkdown,
  DOCUMENT_TITLE_PLACEHOLDER,
  getEditableEmptyDocumentMarkdown,
  getDocumentEditorTitle,
  getEditorInlinePlaceholder,
  isEditorEmptyDocument,
  shouldAutoFocusDocumentTitle,
  splitDocumentEditorMarkdown,
  shouldShowDocumentStartState,
} from "./MarkdownEditor";

describe("editor empty document state", () => {
  it("treats blank markdown as empty", () => {
    expect(isEditorEmptyDocument("")).toBe(true);
    expect(isEditorEmptyDocument("   \n\n")).toBe(true);
  });

  it("treats the default untitled heading as empty", () => {
    expect(isEditorEmptyDocument("# Untitled\n\n")).toBe(true);
    expect(getEditableEmptyDocumentMarkdown("# Untitled\n\n")).toBe("");
  });

  it("treats real markdown content as non-empty", () => {
    expect(isEditorEmptyDocument("# Title")).toBe(false);
    expect(isEditorEmptyDocument("Body")).toBe(false);
  });

  it("shows the start state until editing begins", () => {
    expect(shouldShowDocumentStartState("", false)).toBe(true);
    expect(shouldShowDocumentStartState("", true)).toBe(false);
    expect(shouldShowDocumentStartState("Body", false)).toBe(false);
  });

  it("keeps the editor body free of inline prompt text", () => {
    expect(getEditorInlinePlaceholder()).toBeNull();
  });

  it("removes the legacy English editor prompt text", () => {
    expect(`${editorSource}\n${legacyEditorSource}`).not.toContain("Start writing...");
  });
});

describe("document editor title", () => {
  it("splits the leading level-one heading into title and body", () => {
    expect(splitDocumentEditorMarkdown("# My Title\n\nBody\n")).toEqual({
      title: "My Title",
      body: "Body\n",
    });
  });

  it("keeps later headings in the editable body", () => {
    expect(splitDocumentEditorMarkdown("Intro\n\n# Later\n\nBody")).toEqual({
      title: "",
      body: "Intro\n\n# Later\n\nBody",
    });
  });

  it("composes title and body back into markdown", () => {
    expect(composeDocumentEditorMarkdown("My Title", "Body")).toBe(
      "# My Title\n\nBody",
    );
    expect(composeDocumentEditorMarkdown("", "Body")).toBe("Body");
  });

  it("uses metadata title as the title field fallback", () => {
    expect(getDocumentEditorTitle("Body", "Frontmatter Title")).toBe(
      "Frontmatter Title",
    );
    expect(getDocumentEditorTitle("# Heading\n\nBody", "Frontmatter Title")).toBe(
      "Heading",
    );
    expect(getDocumentEditorTitle("", "Untitled")).toBe("");
  });

  it("defines a Chinese title placeholder", () => {
    expect(DOCUMENT_TITLE_PLACEHOLDER).toBe("写下标题");
  });

  it("focuses the title field first when the title is empty", () => {
    expect(shouldAutoFocusDocumentTitle("")).toBe(true);
    expect(shouldAutoFocusDocumentTitle("  ")).toBe(true);
    expect(shouldAutoFocusDocumentTitle("正文题目")).toBe(false);
  });
});
