import { describe, expect, it } from "vitest";
import appSource from "../../App.tsx?raw";
import editorSource from "./MarkdownEditor.tsx?raw";
import {
  composeDocumentEditorMarkdown,
  DOCUMENT_TITLE_PLACEHOLDER,
  getEditableEmptyDocumentMarkdown,
  getDocumentEditorTitle,
  getEditorInlinePlaceholder,
  isEditorEmptyDocument,
  normalizeEditorBody,
  shouldAutoFocusDocumentTitle,
  splitDocumentEditorMarkdown,
  shouldShowDocumentStartState,
  stripEmptyBlockMarkers,
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

  it("keeps the empty start state paste ingress wired", () => {
    expect(appSource).toContain("getMarkdownTextFromClipboardData");
    expect(appSource).toContain("pasteMarkdownIntoEmptyDocument");
    expect(appSource).toContain("window.addEventListener(\"paste\", handlePaste)");
    expect(appSource).toContain("isEditablePasteTarget");
  });

  it("keeps the editor body free of inline prompt text", () => {
    expect(getEditorInlinePlaceholder()).toBeNull();
  });

  it("removes the legacy English editor prompt text", () => {
    expect(editorSource).not.toContain("Start writing...");
  });

  it("keeps slash insertion in the editor surface", () => {
    expect(editorSource).toContain("SlashCommandMenu");
    expect(editorSource).toContain("matchSlashCommandTriggerText");
    expect(editorSource).toContain("createSlashWriterEditor");
  });

  it("resets the editor content only on external epoch changes", () => {
    expect(editorSource).toContain("export const MarkdownEditor = memo(");
    expect(editorSource).toContain("areMarkdownEditorPropsEqual");
    // The reset is driven by valueEpoch, not by fragile value-string matching.
    expect(editorSource).toContain("valueEpoch: number");
    expect(editorSource).toContain("if (lastEpochRef.current === valueEpoch) return;");
    expect(editorSource).toContain("replaceEditorDocument(value, { notify: false })");
    // The old self-edit string-alignment guard must be gone.
    expect(editorSource).not.toContain("selfEditValueRef");
    // App feeds the session's contentEpoch and no longer tracks a self-edit ref.
    expect(appSource).toContain("valueEpoch={session.contentEpoch}");
    expect(appSource).not.toContain("selfEditedBodyRef");
    expect(appSource).toContain("onChange={handleEditorBodyChange}");
    expect(appSource).toContain("EMPTY_EDITOR_EXTENSIONS");
    expect(appSource).not.toContain("onChange={changeDocumentBody}");
    expect(appSource).not.toContain(
      "editorExtensions={engine.profile.editorExtensions ?? []}",
    );
  });

  it("strips zero-width block markers from copied text", () => {
    expect(stripEmptyBlockMarkers("​Heading​")).toBe("Heading");
    expect(stripEmptyBlockMarkers("plain")).toBe("plain");
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

  // Regression: the editor is uncontrolled and only reset via setMarkdown when
  // the incoming `value` differs from its live content. `value` is derived as
  // split(compose(title, rawBody)).body, so for a self-edit the editor's own
  // content (after normalizeEditorBody) MUST equal that value — otherwise the
  // reset effect fires on every keystroke and the caret jumps to the start.
  describe("self-edit value stays stable (no caret reset)", () => {
    const rawEditorBodies = [
      "hello world",
      "hello\nworld",
      "\nhello", // leading blank line — the case that previously drifted
      "  indented start",
      "line1\n\nline2",
      "# Subheading in body\n\ntext",
      "",
      "text with ​ empty-block marker",
    ];

    for (const rawBody of rawEditorBodies) {
      it(`round-trips ${JSON.stringify(rawBody)}`, () => {
        const title = "My Title";
        // Model the real pipeline: the editor emits raw markdown, onChange
        // strips empty-block markers before it becomes the stored body, then
        // compose→split derives the `value` prop that flows back in.
        const emitted = stripEmptyBlockMarkers(rawBody);
        const source = composeDocumentEditorMarkdown(title, emitted);
        const value = splitDocumentEditorMarkdown(source).body;
        // What the reset effect derives from the editor's live content:
        const editorContent = normalizeEditorBody(rawBody);
        expect(editorContent).toBe(value);
      });
    }
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
