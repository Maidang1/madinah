import {
  GenericJsxEditor,
  codeBlockPlugin,
  codeMirrorPlugin,
  headingsPlugin,
  imagePlugin,
  jsxPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  type JsxComponentDescriptor,
} from "@mdxeditor/editor";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import type {
  EngineProfile,
  SlashCommand,
  WriterCommand,
} from "../../domain/engine";
import { mdxComponents } from "../../components/mdx-components";

export const EMPTY_BLOCK_MARKER = "\u200b";

const jsxComponentDescriptors: JsxComponentDescriptor[] = [
  {
    name: "Callout",
    kind: "flow",
    props: [
      { name: "type", type: "string" },
      { name: "title", type: "string" },
    ],
    hasChildren: true,
    Editor: GenericJsxEditor,
  },
];

const codeBlockLanguages = {
  plaintext: "Plain text",
  typescript: "TypeScript",
  javascript: "JavaScript",
  tsx: "TSX",
  jsx: "JSX",
  rust: "Rust",
  yaml: "YAML",
  bash: "Bash",
  shell: "Shell",
  json: "JSON",
  jsonc: "JSONC",
  markdown: "Markdown",
};

const baseEditorPlugins = [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  tablePlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  imagePlugin(),
  jsxPlugin({ jsxComponentDescriptors }),
  codeBlockPlugin({ defaultCodeBlockLanguage: "typescript" }),
  codeMirrorPlugin({
    codeBlockLanguages,
    autoLoadLanguageSupport: false,
  }),
  markdownShortcutPlugin(),
];

const baseSlashCommands: SlashCommand[] = [
  {
    id: "paragraph",
    label: "Text",
    hint: "Plain paragraph",
    group: "Text",
    keywords: ["paragraph", "body"],
    markdown: `${EMPTY_BLOCK_MARKER}\n`,
  },
  {
    id: "h1",
    label: "Heading 1",
    hint: "Large section title",
    group: "Text",
    keywords: ["title"],
    markdown: `# ${EMPTY_BLOCK_MARKER}\n\n`,
  },
  {
    id: "h2",
    label: "Heading 2",
    hint: "Medium section title",
    group: "Text",
    keywords: ["subtitle", "section"],
    markdown: `## ${EMPTY_BLOCK_MARKER}\n\n`,
  },
  {
    id: "h3",
    label: "Heading 3",
    hint: "Small section title",
    group: "Text",
    keywords: ["subsection"],
    markdown: `### ${EMPTY_BLOCK_MARKER}\n\n`,
  },
  {
    id: "h4",
    label: "Heading 4",
    hint: "Compact section title",
    group: "Text",
    keywords: ["subheading"],
    markdown: `#### ${EMPTY_BLOCK_MARKER}\n\n`,
  },
  {
    id: "h5",
    label: "Heading 5",
    hint: "Small nested title",
    group: "Text",
    keywords: ["subheading"],
    markdown: `##### ${EMPTY_BLOCK_MARKER}\n\n`,
  },
  {
    id: "h6",
    label: "Heading 6",
    hint: "Tiny nested title",
    group: "Text",
    keywords: ["subheading"],
    markdown: `###### ${EMPTY_BLOCK_MARKER}\n\n`,
  },
  {
    id: "bullet",
    label: "Bulleted list",
    hint: "Simple unordered list",
    group: "Lists",
    keywords: ["ul", "unordered"],
    markdown: `- ${EMPTY_BLOCK_MARKER}\n`,
  },
  {
    id: "number",
    label: "Numbered list",
    hint: "Ordered list",
    group: "Lists",
    keywords: ["ol", "ordered"],
    markdown: `1. ${EMPTY_BLOCK_MARKER}\n`,
  },
  {
    id: "checklist",
    label: "Checklist",
    hint: "Task list item",
    group: "Lists",
    keywords: ["todo", "task"],
    markdown: `- [ ] ${EMPTY_BLOCK_MARKER}\n`,
  },
  {
    id: "quote",
    label: "Quote",
    hint: "Block quote",
    group: "Blocks",
    keywords: ["blockquote", "citation"],
    markdown: `> ${EMPTY_BLOCK_MARKER}\n\n`,
  },
  {
    id: "table",
    label: "Table",
    hint: "3 x 3 table",
    group: "Blocks",
    keywords: ["grid"],
    markdown: "|  |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n",
  },
  {
    id: "divider",
    label: "Divider",
    hint: "Horizontal rule",
    group: "Blocks",
    keywords: ["rule", "hr", "separator"],
    markdown: "\n---\n\n",
  },
  {
    id: "frontmatter",
    label: "Frontmatter",
    hint: "YAML metadata block",
    group: "Blocks",
    keywords: ["yaml", "metadata"],
    markdown: `---\ntitle: ${EMPTY_BLOCK_MARKER}\ndescription: \npubDate: \n---\n\n`,
  },
  {
    id: "footnote",
    label: "Footnote",
    hint: "Reference and note pair",
    group: "Blocks",
    keywords: ["reference", "note"],
    markdown: `Here is a footnote reference[^1].\n\n[^1]: ${EMPTY_BLOCK_MARKER}\n`,
  },
  {
    id: "code",
    label: "Code block",
    hint: "Fenced code block",
    group: "Code",
    keywords: ["fence", "snippet"],
    markdown: `\`\`\`\n${EMPTY_BLOCK_MARKER}\n\`\`\`\n\n`,
  },
  createCodeSlashCommand("typescript", "TypeScript"),
  createCodeSlashCommand("tsx", "TSX"),
  createCodeSlashCommand("javascript", "JavaScript"),
  createCodeSlashCommand("rust", "Rust"),
  createCodeSlashCommand("json", "JSON"),
  createCodeSlashCommand("bash", "Bash"),
  createCodeSlashCommand("markdown", "Markdown"),
  createCodeSlashCommand("plaintext", "Plain text"),
  {
    id: "link",
    label: "Link",
    hint: "Inline hyperlink",
    group: "Media",
    keywords: ["href", "anchor", "url"],
    markdown: `[${EMPTY_BLOCK_MARKER}](https://)`,
  },
  {
    id: "image",
    label: "Image",
    hint: "Inline image",
    group: "Media",
    keywords: ["img", "photo", "asset"],
    markdown: `![${EMPTY_BLOCK_MARKER}](https://)`,
  },
  {
    id: "callout",
    label: "Callout",
    hint: "Info callout block",
    group: "MDX",
    keywords: ["aside", "info"],
    markdown: `<Callout type="info">\n\n${EMPTY_BLOCK_MARKER}\n\n</Callout>\n\n`,
  },
  createCalloutSlashCommand("note", "Note callout", "Neutral callout block"),
  createCalloutSlashCommand(
    "warning",
    "Warning callout",
    "Caution callout block",
  ),
  createCalloutSlashCommand("success", "Success callout", "Positive callout block"),
  createCalloutSlashCommand("error", "Error callout", "Critical callout block"),
];

const baseWriterCommands = baseSlashCommands.map(createInsertMarkdownCommand);
const commandBackedSlashCommands = baseSlashCommands.map((command) => ({
  id: command.id,
  label: command.label,
  hint: command.hint,
  group: command.group,
  keywords: command.keywords,
  commandId: toInsertCommandId(command.id),
}));

const standardExcludedCommandIds = new Set([
  "checklist",
  "footnote",
  "callout",
  "callout-note",
  "callout-warning",
  "callout-success",
  "callout-error",
]);

export function createBuiltinProfiles(): EngineProfile[] {
  const standardMarkdown: EngineProfile = {
    id: "standard-markdown",
    name: "Standard Markdown",
    editorPlugins: baseEditorPlugins,
    previewComponents: mdxComponents,
    slashCommands: commandBackedSlashCommands.filter(
      (command) => !standardExcludedCommandIds.has(command.id),
    ),
    commands: baseWriterCommands.filter(
      (command) =>
        !standardExcludedCommandIds.has(command.id.replace("editor.insert.", "")),
    ),
    codeLanguages: [
      { id: "plaintext", label: "Plain text" },
      { id: "markdown", label: "Markdown" },
    ],
  };

  const gfm: EngineProfile = {
    ...standardMarkdown,
    id: "gfm",
    name: "GitHub Flavored Markdown",
    remarkPlugins: [remarkFrontmatter, remarkGfm],
    slashCommands: commandBackedSlashCommands,
    commands: baseWriterCommands,
    codeLanguages: Object.entries(codeBlockLanguages).map(([id, label]) => ({
      id,
      label,
    })),
  };

  const mdxCompatible: EngineProfile = {
    ...gfm,
    id: "mdx-compatible",
    name: "MDX Compatible",
  };

  return [standardMarkdown, gfm, mdxCompatible];
}

function createInsertMarkdownCommand(command: SlashCommand): WriterCommand {
  return {
    id: toInsertCommandId(command.id),
    label: command.label,
    run: ({ editor }) => {
      const target = editor as { insertMarkdown?: (markdown: string) => void } | null;
      if (command.markdown) {
        target?.insertMarkdown?.(command.markdown);
      }
    },
  };
}

function toInsertCommandId(id: string): string {
  return `editor.insert.${id}`;
}

function createCodeSlashCommand(language: string, label: string): SlashCommand {
  return {
    id: `code-${language}`,
    label: `${label} code`,
    hint: `Fenced ${label} block`,
    group: "Code",
    keywords: [language, "code", "fence", "snippet"],
    markdown: `\`\`\`${language}\n${EMPTY_BLOCK_MARKER}\n\`\`\`\n\n`,
  };
}

function createCalloutSlashCommand(
  type: "note" | "warning" | "success" | "error",
  label: string,
  hint: string,
): SlashCommand {
  const title = label.replace(" callout", "");

  return {
    id: `callout-${type}`,
    label,
    hint,
    group: "MDX",
    keywords: ["callout", "aside", type],
    markdown: `<Callout type="${type}" title="${title}">\n\n${EMPTY_BLOCK_MARKER}\n\n</Callout>\n\n`,
  };
}
