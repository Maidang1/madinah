import type { WriterCommand, WriterEditor } from "../../domain/engine";

const FORMAT_COMMAND_SHORTCUTS: Record<string, string> = {
  "editor.format.bold": "⌃B",
  "editor.format.italic": "⌘I",
  "editor.format.link": "⌘K",
  "editor.format.heading1": "⌥⌘1",
  "editor.format.heading2": "⌥⌘2",
  "editor.format.heading3": "⌥⌘3",
};

const FORMAT_COMMAND_PRIORITIES: Record<string, number> = {
  "editor.format.bold": 80,
  "editor.format.italic": 79,
  "editor.format.link": 78,
  "editor.format.heading1": 62,
  "editor.format.heading2": 61,
  "editor.format.heading3": 60,
};

export function createFormattingCommands(): WriterCommand[] {
  return [
    inlineCommand("editor.format.bold", "Bold", "**", "**", "text", ["strong"]),
    inlineCommand("editor.format.italic", "Italic", "_", "_", "text", ["emphasis"]),
    inlineCommand("editor.format.strike", "Strikethrough", "~~", "~~", "text", [
      "delete",
    ]),
    inlineCommand("editor.format.inlineCode", "Inline Code", "`", "`", "code", [
      "monospace",
    ]),
    markdownCommand("editor.format.link", "Link", "Edit", ["url"], (selection) =>
      `[${selection || "link text"}](https://)`,
    ),
    markdownCommand("editor.format.image", "Image", "Insert", ["media"], () =>
      "![Alt text](https://)",
    ),
    markdownCommand("editor.format.quote", "Quote", "Edit", ["blockquote"], (selection) =>
      prefixMarkdownLines(selection || "Quote", "> "),
    ),
    markdownCommand("editor.format.heading1", "Heading 1", "Edit", ["h1"], (selection) =>
      headingMarkdown(selection || "Heading", 1),
    ),
    markdownCommand("editor.format.heading2", "Heading 2", "Edit", ["h2"], (selection) =>
      headingMarkdown(selection || "Heading", 2),
    ),
    markdownCommand("editor.format.heading3", "Heading 3", "Edit", ["h3"], (selection) =>
      headingMarkdown(selection || "Heading", 3),
    ),
    markdownCommand("editor.format.bulletList", "Bulleted List", "Edit", ["ul"], (selection) =>
      prefixMarkdownLines(selection || "List item", "- "),
    ),
    markdownCommand("editor.format.numberedList", "Numbered List", "Edit", ["ol"], (selection) =>
      numberedMarkdownLines(selection || "List item"),
    ),
    markdownCommand("editor.format.codeBlock", "Code Block", "Insert", ["fence"], (selection) =>
      `\`\`\`\n${selection || "code"}\n\`\`\`\n`,
    ),
    markdownCommand("editor.format.table", "Table", "Insert", ["grid"], () =>
      "|  |  |\n| --- | --- |\n|  |  |\n",
    ),
    markdownCommand("editor.format.divider", "Divider", "Insert", ["rule"], () => "\n---\n"),
  ];
}

export function formatMarkdownSelection(
  selection: string,
  prefix: string,
  suffix: string,
  placeholder: string,
): string {
  return `${prefix}${selection || placeholder}${suffix}`;
}

export function prefixMarkdownLines(selection: string, prefix: string): string {
  return selection
    .split("\n")
    .map((line) => (line.trim() ? `${prefix}${line}` : line))
    .join("\n");
}

function inlineCommand(
  id: string,
  label: string,
  prefix: string,
  suffix: string,
  placeholder: string,
  keywords: string[],
): WriterCommand {
  return markdownCommand(id, label, "Edit", keywords, (selection) =>
    formatMarkdownSelection(selection, prefix, suffix, placeholder),
  );
}

function markdownCommand(
  id: string,
  label: string,
  group: string,
  keywords: string[],
  format: (selection: string) => string,
): WriterCommand {
  return {
    id,
    label,
    group,
    keywords,
    shortcut: FORMAT_COMMAND_SHORTCUTS[id],
    scope: group === "Insert" ? "insert" : "edit",
    priority: FORMAT_COMMAND_PRIORITIES[id] ?? (group === "Insert" ? 25 : 45),
    run: ({ editor }) => {
      applyMarkdownEdit(editor, format(editor?.getSelectionMarkdown?.() ?? ""));
    },
  };
}

function applyMarkdownEdit(editor: WriterEditor | null | undefined, markdown: string) {
  if (editor?.replaceSelection && editor.getSelectionMarkdown?.()) {
    editor.replaceSelection(markdown);
    editor.focus?.();
    return;
  }

  editor?.insertMarkdown?.(markdown);
  editor?.focus?.();
}

function headingMarkdown(selection: string, depth: 1 | 2 | 3): string {
  const text = selection.replace(/^#{1,6}\s+/gm, "").trim() || "Heading";
  return `${"#".repeat(depth)} ${text}\n`;
}

function numberedMarkdownLines(selection: string): string {
  return selection
    .split("\n")
    .map((line, index) => (line.trim() ? `${index + 1}. ${line}` : line))
    .join("\n");
}
