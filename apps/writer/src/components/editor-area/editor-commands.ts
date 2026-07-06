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
export type EditorContextMenuGroup = "AI" | "Format" | "Paragraph" | "Insert";

export interface EditorCommandContextMenuItem {
  group: EditorContextMenuGroup;
  itemId: string;
  label?: string;
  accelerator?: string;
  order: number;
  separatorBefore?: boolean;
}

export interface EditorCommand {
  id: string;
  label: string;
  group: string;
  description: string;
  keywords: string[];
  shortcut?: string;
  priority: number;
  surfaces: EditorCommandSurface[];
  contextMenu?: EditorCommandContextMenuItem[];
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

const FORMAT_CONTEXT_MENU_ITEMS: Partial<
  Record<keyof typeof formattingCommands, EditorCommandContextMenuItem[]>
> = {
  "format.bold": [{ group: "Format", itemId: "fmt.bold", accelerator: "CmdOrCtrl+B", order: 10 }],
  "format.italic": [
    { group: "Format", itemId: "fmt.italic", accelerator: "CmdOrCtrl+I", order: 20 },
  ],
  "format.strikethrough": [
    {
      group: "Format",
      itemId: "fmt.strikethrough",
      accelerator: "CmdOrCtrl+Shift+X",
      order: 30,
    },
  ],
  "format.code": [{ group: "Format", itemId: "fmt.code", accelerator: "CmdOrCtrl+E", order: 40 }],
  "format.link": [
    {
      group: "Format",
      itemId: "fmt.link",
      label: "Insert link...",
      accelerator: "CmdOrCtrl+K",
      order: 50,
      separatorBefore: true,
    },
    {
      group: "Insert",
      itemId: "ins.link",
      label: "Link...",
      accelerator: "CmdOrCtrl+K",
      order: 10,
    },
  ],
  "format.heading1": [
    {
      group: "Paragraph",
      itemId: "para.h1",
      accelerator: "CmdOrCtrl+Alt+1",
      order: 10,
    },
  ],
  "format.heading2": [
    {
      group: "Paragraph",
      itemId: "para.h2",
      accelerator: "CmdOrCtrl+Alt+2",
      order: 20,
    },
  ],
  "format.heading3": [
    {
      group: "Paragraph",
      itemId: "para.h3",
      accelerator: "CmdOrCtrl+Alt+3",
      order: 30,
    },
  ],
  "format.heading4": [
    {
      group: "Paragraph",
      itemId: "para.h4",
      accelerator: "CmdOrCtrl+Alt+4",
      order: 40,
    },
  ],
  "format.heading5": [
    {
      group: "Paragraph",
      itemId: "para.h5",
      accelerator: "CmdOrCtrl+Alt+5",
      order: 50,
    },
  ],
  "format.heading6": [
    {
      group: "Paragraph",
      itemId: "para.h6",
      accelerator: "CmdOrCtrl+Alt+6",
      order: 60,
    },
  ],
  "format.paragraph": [
    {
      group: "Paragraph",
      itemId: "para.paragraph",
      accelerator: "CmdOrCtrl+Alt+0",
      order: 70,
    },
  ],
  "format.bulletList": [
    {
      group: "Paragraph",
      itemId: "para.bullet",
      label: "Bullet list",
      accelerator: "CmdOrCtrl+Shift+8",
      order: 80,
      separatorBefore: true,
    },
  ],
  "format.numberedList": [
    {
      group: "Paragraph",
      itemId: "para.numbered",
      label: "Numbered list",
      accelerator: "CmdOrCtrl+Shift+7",
      order: 90,
    },
  ],
  "format.taskList": [
    {
      group: "Paragraph",
      itemId: "para.task",
      label: "Task list",
      accelerator: "CmdOrCtrl+Shift+Enter",
      order: 100,
    },
  ],
  "format.blockquote": [
    {
      group: "Paragraph",
      itemId: "para.blockquote",
      accelerator: "CmdOrCtrl+Shift+.",
      order: 110,
      separatorBefore: true,
    },
  ],
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
    contextMenu: [
      {
        group: "Format",
        itemId: "fmt.clear",
        order: 60,
        separatorBefore: true,
      },
    ],
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
    contextMenu: [
      {
        group: "Paragraph",
        itemId: "para.codeblock",
        order: 120,
      },
    ],
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
    contextMenu: [{ group: "Insert", itemId: "ins.image", order: 20 }],
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
    contextMenu: [{ group: "Insert", itemId: "ins.table", order: 30 }],
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
    contextMenu: [{ group: "Insert", itemId: "ins.callout", order: 40 }],
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
    contextMenu: [{ group: "Insert", itemId: "ins.math", order: 50 }],
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
    contextMenu: [{ group: "Insert", itemId: "ins.footnote", order: 60 }],
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
    contextMenu: [{ group: "Insert", itemId: "ins.hr", label: "Horizontal rule", order: 70 }],
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
    contextMenu: [
      {
        group: "Insert",
        itemId: "ins.comment",
        order: 80,
        separatorBefore: true,
      },
    ],
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
    contextMenu: [{ group: "Insert", itemId: "ins.frontmatter", order: 90 }],
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
    contextMenu: [
      {
        group: "Insert",
        itemId: "ins.date",
        label: "Current date",
        order: 100,
        separatorBefore: true,
      },
    ],
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
    contextMenu: [{ group: "Insert", itemId: "ins.time", label: "Current time", order: 110 }],
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
      contextMenu: FORMAT_CONTEXT_MENU_ITEMS[typedId],
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
    contextMenu: [{ group: "AI", itemId: AI_REWRITE_SELECTION_COMMAND_ID, order: 10 }],
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
    contextMenu: [{ group: "AI", itemId: AI_GENERATE_METADATA_COMMAND_ID, order: 20 }],
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
    contextMenu: [{ group: "AI", itemId: AI_POLISH_DOCUMENT_COMMAND_ID, order: 30 }],
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
    contextMenu: [{ group: "AI", itemId: AI_REVIEW_DOCUMENT_COMMAND_ID, order: 40 }],
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

export interface EditorContextMenuCommandItem {
  commandId: string;
  itemId: string;
  label: string;
  accelerator?: string;
  separatorBefore?: boolean;
}

export interface EditorContextMenuCommandGroup {
  group: EditorContextMenuGroup;
  items: EditorContextMenuCommandItem[];
}

type OrderedEditorContextMenuCommandItem = EditorContextMenuCommandItem & { order: number };

const CONTEXT_MENU_GROUP_ORDER: EditorContextMenuGroup[] = ["AI", "Format", "Paragraph", "Insert"];

export function getEditorContextMenuCommandGroups(): EditorContextMenuCommandGroup[] {
  const groups: EditorContextMenuCommandGroup[] = [];

  for (const group of CONTEXT_MENU_GROUP_ORDER) {
    const items: OrderedEditorContextMenuCommandItem[] = [];

    for (const command of EDITOR_COMMANDS) {
      if (!command.surfaces.includes("context")) continue;

      for (const placement of command.contextMenu ?? []) {
        if (placement.group !== group) continue;

        const item: OrderedEditorContextMenuCommandItem = {
          commandId: command.id,
          itemId: placement.itemId,
          label: placement.label ?? command.label,
          order: placement.order,
        };
        if (placement.accelerator) item.accelerator = placement.accelerator;
        if (placement.separatorBefore) item.separatorBefore = true;
        items.push(item);
      }
    }

    if (items.length > 0) {
      groups.push({
        group,
        items: items
          .sort((left, right) => left.order - right.order)
          .map(({ order: _order, ...item }) => item),
      });
    }
  }

  return groups;
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
