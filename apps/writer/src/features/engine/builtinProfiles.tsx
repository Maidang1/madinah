import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import type { EngineProfile, WriterCommand } from "../../domain/engine";
import { mdxComponents } from "../../components/mdx-components";
import {
  createMarkdownEditorProfileExtension,
} from "../editor/codemirror/profile";
import {
  CODE_BLOCK_LANGUAGES,
} from "./codeBlockLanguages";

export const EMPTY_BLOCK_MARKER = "\u200b";

interface InsertMarkdownTemplate {
  id: string;
  label: string;
  hint: string;
  group?: string;
  keywords?: string[];
  markdown: string;
}

function editablePlaceholder(value: string): string {
  return `${EMPTY_BLOCK_MARKER}${value}${EMPTY_BLOCK_MARKER}`;
}

const commonmarkEditorExtensions = [
  createMarkdownEditorProfileExtension("commonmark"),
];
const gfmEditorExtensions = [createMarkdownEditorProfileExtension("gfm")];
const mdxEditorExtensions = [createMarkdownEditorProfileExtension("mdx")];
const blogMdxEditorExtensions = [
  createMarkdownEditorProfileExtension("blog-mdx"),
];

const baseInsertTemplates: InsertMarkdownTemplate[] = [
  {
    id: "paragraph",
    label: "Text",
    hint: "Plain paragraph",
    group: "Text",
    keywords: ["paragraph", "body"],
    markdown: `${editablePlaceholder("Text")}\n`,
  },
  {
    id: "h1",
    label: "Heading 1",
    hint: "Large section title",
    group: "Text",
    keywords: ["title"],
    markdown: `# ${editablePlaceholder("Heading 1")}\n\n`,
  },
  {
    id: "h2",
    label: "Heading 2",
    hint: "Medium section title",
    group: "Text",
    keywords: ["subtitle", "section"],
    markdown: `## ${editablePlaceholder("Heading 2")}\n\n`,
  },
  {
    id: "h3",
    label: "Heading 3",
    hint: "Small section title",
    group: "Text",
    keywords: ["subsection"],
    markdown: `### ${editablePlaceholder("Heading 3")}\n\n`,
  },
  {
    id: "h4",
    label: "Heading 4",
    hint: "Compact section title",
    group: "Text",
    keywords: ["subheading"],
    markdown: `#### ${editablePlaceholder("Heading 4")}\n\n`,
  },
  {
    id: "h5",
    label: "Heading 5",
    hint: "Small nested title",
    group: "Text",
    keywords: ["subheading"],
    markdown: `##### ${editablePlaceholder("Heading 5")}\n\n`,
  },
  {
    id: "h6",
    label: "Heading 6",
    hint: "Tiny nested title",
    group: "Text",
    keywords: ["subheading"],
    markdown: `###### ${editablePlaceholder("Heading 6")}\n\n`,
  },
  {
    id: "bullet",
    label: "Bulleted list",
    hint: "Simple unordered list",
    group: "Lists",
    keywords: ["ul", "unordered"],
    markdown: `- ${editablePlaceholder("List item")}\n`,
  },
  {
    id: "number",
    label: "Numbered list",
    hint: "Ordered list",
    group: "Lists",
    keywords: ["ol", "ordered"],
    markdown: `1. ${editablePlaceholder("List item")}\n`,
  },
  {
    id: "checklist",
    label: "Checklist",
    hint: "Task list item",
    group: "Lists",
    keywords: ["todo", "task"],
    markdown: `- [ ] ${editablePlaceholder("Task")}\n`,
  },
  {
    id: "quote",
    label: "Quote",
    hint: "Block quote",
    group: "Blocks",
    keywords: ["blockquote", "citation"],
    markdown: `> ${editablePlaceholder("Quote")}\n\n`,
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
    markdown: `---\ntitle: ${editablePlaceholder("Untitled")}\ndescription: \npubDate: \n---\n\n`,
  },
  {
    id: "footnote",
    label: "Footnote",
    hint: "Reference and note pair",
    group: "Blocks",
    keywords: ["reference", "note"],
    markdown: `Here is a footnote reference[^1].\n\n[^1]: ${editablePlaceholder("Footnote")}\n`,
  },
  {
    id: "code",
    label: "Code block",
    hint: "Editable syntax-highlighted code block",
    group: "Code",
    keywords: ["code", "codeblock", "fence", "snippet", "pre"],
    markdown: "```typescript\n\n```\n\n",
  },
  createCodeInsertTemplate("typescript", "TypeScript"),
  createCodeInsertTemplate("tsx", "TSX"),
  createCodeInsertTemplate("javascript", "JavaScript"),
  createCodeInsertTemplate("rust", "Rust"),
  createCodeInsertTemplate("json", "JSON"),
  createCodeInsertTemplate("bash", "Bash"),
  createCodeInsertTemplate("markdown", "Markdown"),
  createCodeInsertTemplate("plaintext", "Plain text"),
  {
    id: "link",
    label: "Link",
    hint: "Inline hyperlink",
    group: "Media",
    keywords: ["href", "anchor", "url"],
    markdown: `[${editablePlaceholder("link text")}](https://)`,
  },
  {
    id: "image",
    label: "Image",
    hint: "Inline image",
    group: "Media",
    keywords: ["img", "photo", "asset"],
    markdown: `![${editablePlaceholder("Alt text")}](https://)`,
  },
  {
    id: "callout",
    label: "Callout",
    hint: "Info callout block",
    group: "MDX",
    keywords: ["aside", "info"],
    markdown: `<Callout type="info">\n\n${editablePlaceholder("Callout content")}\n\n</Callout>\n\n`,
  },
  createCalloutInsertTemplate("note", "Note callout", "Neutral callout block"),
  createCalloutInsertTemplate(
    "warning",
    "Warning callout",
    "Caution callout block",
  ),
  createCalloutInsertTemplate("success", "Success callout", "Positive callout block"),
  createCalloutInsertTemplate("error", "Error callout", "Critical callout block"),
];

const baseWriterCommands = baseInsertTemplates.map(createInsertMarkdownCommand);

const commonmarkExcludedCommandIds = new Set([
  "table",
  "checklist",
  "footnote",
  "frontmatter",
  "callout",
  "callout-note",
  "callout-warning",
  "callout-success",
  "callout-error",
]);

const gfmExcludedCommandIds = new Set([
  "frontmatter",
  "callout",
  "callout-note",
  "callout-warning",
  "callout-success",
  "callout-error",
]);

const mdxExcludedCommandIds = new Set([
  "frontmatter",
]);

function excludeCommands(excludedIds: Set<string>) {
  return {
    commands: baseWriterCommands.filter(
      (command) => !excludedIds.has(command.id.replace("editor.insert.", "")),
    ),
  };
}

const commonmarkCommands = excludeCommands(commonmarkExcludedCommandIds);
const gfmCommands = excludeCommands(gfmExcludedCommandIds);
const mdxCommands = excludeCommands(mdxExcludedCommandIds);

const commonmarkCodeLanguages = [
  { id: "plaintext", label: "Plain text" },
  { id: "markdown", label: "Markdown" },
];

const fullCodeLanguages = CODE_BLOCK_LANGUAGES.map((language) => ({
  id: language.alias?.[0] ?? language.name.toLowerCase(),
  label: language.name,
  aliases: language.alias ? [...language.alias] : undefined,
}));

export function createBuiltinProfiles(): EngineProfile[] {
  const commonmark: EngineProfile = {
    id: "commonmark",
    name: "CommonMark",
    editorExtensions: commonmarkEditorExtensions,
    commands: commonmarkCommands.commands,
    codeLanguages: commonmarkCodeLanguages,
  };

  const gfm: EngineProfile = {
    id: "gfm",
    name: "GitHub Flavored Markdown",
    remarkPlugins: [remarkGfm],
    editorExtensions: gfmEditorExtensions,
    commands: gfmCommands.commands,
    codeLanguages: fullCodeLanguages,
  };

  const mdx: EngineProfile = {
    id: "mdx",
    name: "MDX",
    remarkPlugins: [remarkGfm],
    editorExtensions: mdxEditorExtensions,
    previewComponents: mdxComponents,
    commands: mdxCommands.commands,
    codeLanguages: fullCodeLanguages,
  };

  const blogMdx: EngineProfile = {
    ...mdx,
    id: "blog-mdx",
    name: "Blog MDX",
    remarkPlugins: [remarkFrontmatter, remarkGfm],
    editorExtensions: blogMdxEditorExtensions,
    commands: baseWriterCommands,
  };

  return [commonmark, gfm, mdx, blogMdx];
}

function createInsertMarkdownCommand(command: InsertMarkdownTemplate): WriterCommand {
  return {
    id: toInsertCommandId(command.id),
    label: command.label,
    group: "Insert",
    keywords: [command.group ?? "Insert", command.hint, ...(command.keywords ?? [])],
    scope: "insert",
    surfaces: ["palette", "slash"],
    priority: 10,
    run: ({ editor }) => {
      if (command.markdown) {
        editor?.insertMarkdown?.(command.markdown);
      }
    },
  };
}

function toInsertCommandId(id: string): string {
  return `editor.insert.${id}`;
}

function createCodeInsertTemplate(
  language: string,
  label: string,
): InsertMarkdownTemplate {
  return {
    id: `code-${language}`,
    label: `${label} code`,
    hint: `Editable ${label} block`,
    group: "Code",
    keywords: [language, "code", "codeblock", "fence", "snippet"],
    markdown: `\`\`\`${language}\n\n\`\`\`\n\n`,
  };
}

function createCalloutInsertTemplate(
  type: "note" | "warning" | "success" | "error",
  label: string,
  hint: string,
): InsertMarkdownTemplate {
  const title = label.replace(" callout", "");

  return {
    id: `callout-${type}`,
    label,
    hint,
    group: "MDX",
    keywords: ["callout", "aside", type],
    markdown: `<Callout type="${type}" title="${title}">\n\n${editablePlaceholder(`${title} content`)}\n\n</Callout>\n\n`,
  };
}
