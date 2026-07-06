import type { EditorView } from "@codemirror/view";
import type { StateCommand } from "@codemirror/state";
import {
  clearInlineFormatting,
  formattingCommands,
  insertCallout,
  insertFootnote,
  insertFrontmatter,
  insertHtmlComment,
  insertHorizontalRule,
  insertImage,
  insertMathBlock,
  insertNow,
  insertTable,
  insertToday,
  toggleFencedCodeBlock,
} from "./markdown-formatting";
import { setAiOperation } from "./ai-operation-store";
import { setAiReviewState } from "./ai-review-store";
import * as tauri from "@/lib/tauri";
import { applyAiMetadataToFrontmatter } from "@/lib/ai-metadata";
import { getOpenFile, updateFrontmatter } from "@/hooks/editor-api";
import { getWorkspaceRoot } from "@/hooks/workspace-api";

export type EditorCommandSurface = "context" | "slash";

export interface EditorCommand {
  id: string;
  label: string;
  group: string;
  description: string;
  keywords: string[];
  shortcut?: string;
  priority: number;
  surfaces: EditorCommandSurface[];
  run: (view: EditorView, filePath: string) => void | Promise<void>;
}

const FORMAT_COMMAND_LABELS: Record<keyof typeof formattingCommands, string> = {
  "format.bold": "Bold",
  "format.italic": "Italic",
  "format.link": "Link",
  "format.code": "Inline code",
  "format.strikethrough": "Strikethrough",
  "format.bulletList": "Bullet list",
  "format.numberedList": "Numbered list",
  "format.blockquote": "Blockquote",
  "format.taskList": "Task list",
  "format.heading1": "Heading 1",
  "format.heading2": "Heading 2",
  "format.heading3": "Heading 3",
  "format.heading4": "Heading 4",
  "format.heading5": "Heading 5",
  "format.heading6": "Heading 6",
  "format.paragraph": "Paragraph",
};

const FORMAT_COMMAND_GROUPS: Partial<Record<keyof typeof formattingCommands, string>> = {
  "format.bold": "Format",
  "format.italic": "Format",
  "format.link": "Insert",
  "format.code": "Format",
  "format.strikethrough": "Format",
  "format.heading1": "Paragraph",
  "format.heading2": "Paragraph",
  "format.heading3": "Paragraph",
  "format.heading4": "Paragraph",
  "format.heading5": "Paragraph",
  "format.heading6": "Paragraph",
  "format.paragraph": "Paragraph",
  "format.bulletList": "Lists",
  "format.numberedList": "Lists",
  "format.taskList": "Lists",
  "format.blockquote": "Paragraph",
};

const EXTRA_COMMANDS: Array<
  Omit<EditorCommand, "run"> & {
    command: StateCommand;
  }
> = [
  {
    id: "clearInlineFormatting",
    label: "Clear formatting",
    group: "Format",
    description: "Remove inline Markdown markers",
    keywords: ["clear", "format"],
    priority: 30,
    surfaces: ["context", "slash"],
    command: clearInlineFormatting,
  },
  {
    id: "toggleFencedCodeBlock",
    label: "Code block",
    group: "Insert",
    description: "Insert or toggle a fenced code block",
    keywords: ["code", "fence"],
    priority: 68,
    surfaces: ["context", "slash"],
    command: toggleFencedCodeBlock,
  },
  {
    id: "insertImage",
    label: "Image",
    group: "Insert",
    description: "Insert Markdown image syntax",
    keywords: ["image", "img", "media", "picture", "markdown"],
    priority: 78,
    surfaces: ["context", "slash"],
    command: insertImage,
  },
  {
    id: "insertTable",
    label: "Table",
    group: "Insert",
    description: "Insert a Markdown table",
    keywords: ["table", "grid"],
    priority: 76,
    surfaces: ["context", "slash"],
    command: insertTable,
  },
  {
    id: "insertCallout",
    label: "Callout",
    group: "Insert",
    description: "Insert an Obsidian-style callout block",
    keywords: ["callout", "admonition", "note", "quote", "markdown"],
    priority: 74,
    surfaces: ["context", "slash"],
    command: insertCallout,
  },
  {
    id: "insertMathBlock",
    label: "Math block",
    group: "Insert",
    description: "Insert a block math fence",
    keywords: ["math", "latex", "formula", "equation", "markdown"],
    priority: 72,
    surfaces: ["context", "slash"],
    command: insertMathBlock,
  },
  {
    id: "insertFootnote",
    label: "Footnote",
    group: "Insert",
    description: "Insert a numbered footnote reference and definition",
    keywords: ["footnote", "reference", "note", "markdown"],
    priority: 70,
    surfaces: ["context", "slash"],
    command: insertFootnote,
  },
  {
    id: "insertHorizontalRule",
    label: "Divider",
    group: "Insert",
    description: "Insert a horizontal rule",
    keywords: ["divider", "rule", "hr"],
    priority: 60,
    surfaces: ["context", "slash"],
    command: insertHorizontalRule,
  },
  {
    id: "insertHtmlComment",
    label: "HTML comment",
    group: "Insert",
    description: "Insert an HTML comment",
    keywords: ["comment", "html", "note", "hidden", "markdown"],
    priority: 58,
    surfaces: ["context", "slash"],
    command: insertHtmlComment,
  },
  {
    id: "insertFrontmatter",
    label: "YAML frontmatter",
    group: "Insert",
    description: "Insert a YAML frontmatter block",
    keywords: ["frontmatter", "yaml", "metadata", "title", "markdown"],
    priority: 56,
    surfaces: ["context", "slash"],
    command: insertFrontmatter,
  },
  {
    id: "insertToday",
    label: "Current date",
    group: "Insert",
    description: "Insert today's date",
    keywords: ["date", "today"],
    priority: 45,
    surfaces: ["context", "slash"],
    command: insertToday,
  },
  {
    id: "insertNow",
    label: "Current time",
    group: "Insert",
    description: "Insert the current time",
    keywords: ["time", "now"],
    priority: 44,
    surfaces: ["context", "slash"],
    command: insertNow,
  },
];

export const AI_POLISH_DOCUMENT_COMMAND_ID = "ai.polishDocument";
export const AI_REWRITE_SELECTION_COMMAND_ID = "ai.rewriteSelection";
export const AI_GENERATE_METADATA_COMMAND_ID = "ai.generateMetadata";
export const AI_REVIEW_DOCUMENT_COMMAND_ID = "ai.reviewDocument";

export const EDITOR_COMMANDS: EditorCommand[] = [
  ...Object.entries(formattingCommands).map(([id, command], index): EditorCommand => {
    const typedId = id as keyof typeof formattingCommands;
    return {
      id,
      label: FORMAT_COMMAND_LABELS[typedId],
      group: FORMAT_COMMAND_GROUPS[typedId] ?? "Format",
      description: "Markdown command",
      keywords: [FORMAT_COMMAND_LABELS[typedId], id],
      shortcut: command.chord,
      priority: 100 - index,
      surfaces: ["context", "slash"],
      run: (view) => {
        runStateCommand(view, command.run);
      },
    };
  }),
  ...EXTRA_COMMANDS.map(
    ({ command, ...entry }): EditorCommand => ({
      ...entry,
      run: (view: EditorView) => {
        runStateCommand(view, command);
      },
    }),
  ),
  {
    id: AI_REWRITE_SELECTION_COMMAND_ID,
    label: "Rewrite selection",
    group: "AI",
    description: "Improve the selected Markdown",
    keywords: ["ai", "rewrite", "polish", "selection"],
    priority: 88,
    surfaces: ["context", "slash"],
    run: (view, filePath) => rewriteSelectionWithAi(view, filePath),
  },
  {
    id: AI_GENERATE_METADATA_COMMAND_ID,
    label: "Generate metadata",
    group: "AI",
    description: "Generate Madinah blog frontmatter",
    keywords: ["ai", "metadata", "frontmatter", "title", "description", "tags", "slug"],
    priority: 86,
    surfaces: ["context", "slash"],
    run: (view, filePath) => generateMetadataWithAi(view, filePath),
  },
  {
    id: AI_POLISH_DOCUMENT_COMMAND_ID,
    label: "Polish document",
    group: "AI",
    description: "Polish the full Markdown document",
    keywords: ["ai", "polish", "document", "rewrite"],
    priority: 84,
    surfaces: ["context", "slash"],
    run: (view, filePath) => polishDocumentWithAi(view, filePath),
  },
  {
    id: AI_REVIEW_DOCUMENT_COMMAND_ID,
    label: "Review document",
    group: "AI",
    description: "Review structure and clarity",
    keywords: ["ai", "review", "issues", "structure", "clarity"],
    priority: 82,
    surfaces: ["context", "slash"],
    run: (view, filePath) => reviewDocumentWithAi(view, filePath),
  },
];

const COMMAND_BY_ID = new Map(EDITOR_COMMANDS.map((command) => [command.id, command]));

export function getEditorCommand(id: string): EditorCommand | undefined {
  return COMMAND_BY_ID.get(id);
}

export function getEditorCommandsForSurface(surface: EditorCommandSurface): EditorCommand[] {
  return EDITOR_COMMANDS.filter((command) => command.surfaces.includes(surface)).sort(
    (left, right) => right.priority - left.priority,
  );
}

export function runEditorCommand(id: string, view: EditorView, filePath: string): boolean {
  const command = getEditorCommand(id);
  if (!command) return false;

  view.focus();
  void Promise.resolve(command.run(view, filePath)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    setAiOperation({
      status: "error",
      label: "Command failed",
      detail: message,
    });
    console.error("[editor] Command failed:", error);
  });
  return true;
}

function runStateCommand(view: EditorView, command: StateCommand): boolean {
  return command({ state: view.state, dispatch: (tr) => view.dispatch(tr) });
}

async function polishDocumentWithAi(view: EditorView, filePath: string) {
  const content = view.state.doc.toString();
  if (!content.trim()) {
    throw new Error("Nothing to polish");
  }

  setAiOperation({
    status: "running",
    label: "Polishing document",
    detail: "AI is rewriting the current document",
  });

  const result = await tauri.runAiAction({
    kind: "polish-document",
    content,
    workspaceRoot: getWorkspaceRoot(),
  });

  const next = result.content.trim();
  if (!next) throw new Error("AI returned empty content");

  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: next },
    selection: { anchor: 0 },
    userEvent: "input.ai.polishDocument",
  });
  view.focus();

  setAiOperation({
    status: "success",
    label: "Document polished",
    detail: `${providerLabel(result.provider)} replaced ${filePath.split("/").pop() ?? "document"}`,
  });
}

async function rewriteSelectionWithAi(view: EditorView, _filePath: string) {
  const selection = view.state.selection.main;
  if (selection.empty) {
    throw new Error("Select text to rewrite");
  }
  const content = view.state.sliceDoc(selection.from, selection.to);
  if (!content.trim()) {
    throw new Error("Select text to rewrite");
  }

  setAiOperation({
    status: "running",
    label: "Rewriting selection",
    detail: "AI is improving the selected Markdown",
  });

  const result = await tauri.runAiAction({
    kind: "rewrite-selection",
    content,
    workspaceRoot: getWorkspaceRoot(),
  });

  const next = result.content.trim();
  if (!next) throw new Error("AI returned empty content");

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: next },
    selection: { anchor: selection.from, head: selection.from + next.length },
    userEvent: "input.ai.rewriteSelection",
  });
  view.focus();

  setAiOperation({
    status: "success",
    label: "Selection rewritten",
    detail: `Applied ${providerLabel(result.provider)} result`,
  });
}

async function generateMetadataWithAi(view: EditorView, filePath: string) {
  const content = view.state.doc.toString();
  if (!content.trim()) {
    throw new Error("Nothing to analyze");
  }

  setAiOperation({
    status: "running",
    label: "Generating metadata",
    detail: "AI is reading the current document",
  });

  const result = await tauri.runAiAction({
    kind: "generate-metadata",
    content,
    workspaceRoot: getWorkspaceRoot(),
  });

  if (!result.metadata) {
    throw new Error("AI returned metadata without parsed result");
  }

  const current = getOpenFile(filePath);
  const next = applyAiMetadataToFrontmatter(current?.frontmatter ?? null, result.metadata);
  updateFrontmatter(filePath, next);
  view.focus();

  setAiOperation({
    status: "success",
    label: "Metadata generated",
    detail: `${providerLabel(result.provider)} updated title, description, tags, and slug`,
  });
}

async function reviewDocumentWithAi(view: EditorView, filePath: string) {
  const content = view.state.doc.toString();
  if (!content.trim()) {
    throw new Error("Nothing to review");
  }

  setAiReviewState({
    status: "loading",
    filePath,
    message: "Reviewing document",
    review: null,
    updatedAt: null,
  });
  setAiOperation({
    status: "running",
    label: "Reviewing document",
    detail: "AI is checking structure and clarity",
  });

  try {
    const result = await tauri.runAiAction({
      kind: "review-document",
      content,
      workspaceRoot: getWorkspaceRoot(),
    });

    if (!result.review) {
      throw new Error("AI returned review without parsed result");
    }

    setAiReviewState({
      status: "ready",
      filePath,
      message: "Review ready",
      review: result.review,
      updatedAt: new Date().toISOString(),
    });
    view.focus();

    setAiOperation({
      status: "success",
      label: "Review ready",
      detail: `${providerLabel(result.provider)} found ${result.review.issues.length} issue${
        result.review.issues.length === 1 ? "" : "s"
      }`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setAiReviewState({
      status: "error",
      filePath,
      message,
      review: null,
      updatedAt: null,
    });
    throw error;
  }
}

function providerLabel(provider: tauri.AiAgentProvider): string {
  return provider === "claude" ? "Claude Code" : "Codex";
}
