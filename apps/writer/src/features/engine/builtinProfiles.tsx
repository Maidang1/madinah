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
    markdown: `${EMPTY_BLOCK_MARKER}\n`,
  },
  {
    id: "h1",
    label: "Heading 1",
    hint: "Large section title",
    markdown: `# ${EMPTY_BLOCK_MARKER}\n\n`,
  },
  {
    id: "h2",
    label: "Heading 2",
    hint: "Medium section title",
    markdown: `## ${EMPTY_BLOCK_MARKER}\n\n`,
  },
  {
    id: "h3",
    label: "Heading 3",
    hint: "Small section title",
    markdown: `### ${EMPTY_BLOCK_MARKER}\n\n`,
  },
  {
    id: "bullet",
    label: "Bulleted list",
    hint: "Simple unordered list",
    markdown: `- ${EMPTY_BLOCK_MARKER}\n`,
  },
  {
    id: "number",
    label: "Numbered list",
    hint: "Ordered list",
    markdown: `1. ${EMPTY_BLOCK_MARKER}\n`,
  },
  {
    id: "quote",
    label: "Quote",
    hint: "Block quote",
    markdown: `> ${EMPTY_BLOCK_MARKER}\n\n`,
  },
  {
    id: "code",
    label: "Code block",
    hint: "Fenced TypeScript block",
    markdown: "```typescript\n\n```\n\n",
  },
  {
    id: "table",
    label: "Table",
    hint: "3 x 3 table",
    markdown: "|  |  |  |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n",
  },
  {
    id: "divider",
    label: "Divider",
    hint: "Horizontal rule",
    markdown: "\n---\n\n",
  },
  {
    id: "callout",
    label: "Callout",
    hint: "Madinah callout block",
    markdown: `<Callout type="info">\n\n${EMPTY_BLOCK_MARKER}\n\n</Callout>\n\n`,
  },
];

const baseWriterCommands = baseSlashCommands.map(createInsertMarkdownCommand);
const commandBackedSlashCommands = baseSlashCommands.map((command) => ({
  id: command.id,
  label: command.label,
  hint: command.hint,
  commandId: toInsertCommandId(command.id),
}));

export function createBuiltinProfiles(): EngineProfile[] {
  const standardMarkdown: EngineProfile = {
    id: "standard-markdown",
    name: "Standard Markdown",
    editorPlugins: baseEditorPlugins,
    previewComponents: mdxComponents,
    slashCommands: commandBackedSlashCommands.filter(
      (command) => command.id !== "callout",
    ),
    commands: baseWriterCommands.filter(
      (command) => command.id !== toInsertCommandId("callout"),
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
