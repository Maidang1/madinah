import { cpp } from "@codemirror/lang-cpp";
import { css } from "@codemirror/lang-css";
import { go } from "@codemirror/lang-go";
import { html } from "@codemirror/lang-html";
import { java } from "@codemirror/lang-java";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { php } from "@codemirror/lang-php";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";
import {
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { CodeBlockLanguage } from "@mdxeditor/editor";

// The canonical fence token for each language is `alias[0]`; MDXEditor derives
// the ```<token> written into markdown from it, so these must stay stable to
// keep existing documents parsing. `extensions` lets a fence use a file
// extension (e.g. ```ts) and still resolve to the right grammar.
export const CODE_BLOCK_LANGUAGES: CodeBlockLanguage[] = [
  {
    name: "Plain text",
    alias: ["plaintext", "text", "txt"],
  },
  {
    name: "TypeScript",
    alias: ["typescript", "ts"],
    support: { extension: javascript({ typescript: true }) },
  },
  {
    name: "TSX",
    alias: ["tsx"],
    support: { extension: javascript({ typescript: true, jsx: true }) },
  },
  {
    name: "JavaScript",
    alias: ["javascript", "js", "mjs", "cjs"],
    support: { extension: javascript() },
  },
  {
    name: "JSX",
    alias: ["jsx"],
    support: { extension: javascript({ jsx: true }) },
  },
  {
    name: "JSON",
    alias: ["json", "jsonc"],
    support: { extension: json() },
  },
  {
    name: "HTML",
    alias: ["html", "htm"],
    support: { extension: html() },
  },
  {
    name: "CSS",
    alias: ["css"],
    support: { extension: css() },
  },
  {
    name: "Python",
    alias: ["python", "py"],
    support: { extension: python() },
  },
  {
    name: "Rust",
    alias: ["rust", "rs"],
    support: { extension: rust() },
  },
  {
    name: "Go",
    alias: ["go", "golang"],
    support: { extension: go() },
  },
  {
    name: "Java",
    alias: ["java"],
    support: { extension: java() },
  },
  {
    name: "C / C++",
    alias: ["cpp", "c", "c++", "h", "hpp"],
    support: { extension: cpp() },
  },
  {
    name: "PHP",
    alias: ["php"],
    support: { extension: php() },
  },
  {
    name: "SQL",
    alias: ["sql"],
    support: { extension: sql() },
  },
  {
    name: "XML",
    alias: ["xml", "svg"],
    support: { extension: xml() },
  },
  {
    name: "YAML",
    alias: ["yaml", "yml"],
    support: { extension: yaml() },
  },
  {
    name: "Markdown",
    alias: ["markdown", "md"],
    support: { extension: markdown() },
  },
  {
    name: "Bash",
    alias: ["bash", "sh", "shell", "zsh"],
  },
];

// A dark editor chrome matching the app's code block surface. The plugin
// applies `basicLight` after our extensions, so this must win — the caller
// wraps it with a high precedence.
const editorTheme = EditorView.theme(
  {
    "&": {
      color: "rgb(237, 236, 238)",
      backgroundColor: "transparent",
    },
    ".cm-content": {
      caretColor: "rgb(237, 236, 238)",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "rgb(237, 236, 238)",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      {
        backgroundColor: "rgba(120, 140, 255, 0.28)",
      },
    ".cm-activeLine": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
    },
    ".cm-selectionMatch": {
      backgroundColor: "rgba(120, 140, 255, 0.2)",
    },
  },
  { dark: true },
);

// A high-contrast highlight palette tuned for the dark code surface.
const highlightStyle = HighlightStyle.define(
  [
    { tag: [t.comment, t.lineComment, t.blockComment], color: "#7d8590", fontStyle: "italic" },
    { tag: [t.keyword, t.moduleKeyword, t.controlKeyword, t.operatorKeyword], color: "#ff7b9c" },
    { tag: [t.string, t.special(t.string), t.regexp], color: "#a5d6ff" },
    { tag: [t.number, t.bool, t.null], color: "#f7c076" },
    { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: "#d2a8ff" },
    { tag: [t.definition(t.variableName), t.variableName], color: "#e6edf3" },
    { tag: [t.propertyName, t.attributeName], color: "#79c0ff" },
    { tag: [t.typeName, t.className, t.namespace], color: "#6ee7b7" },
    { tag: [t.tagName, t.angleBracket], color: "#7ee787" },
    { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: "#c9d1d9" },
    { tag: [t.meta, t.annotation], color: "#79c0ff" },
    { tag: t.link, color: "#a5d6ff", textDecoration: "underline" },
    { tag: [t.heading], color: "#79c0ff", fontWeight: "bold" },
    { tag: [t.emphasis], fontStyle: "italic" },
    { tag: [t.strong], fontWeight: "bold" },
    { tag: t.invalid, color: "#ff7b72" },
  ],
  { themeType: "dark" },
);

// Editor-wide extensions applied to every code block: dark chrome plus the
// syntax colouring that the per-language grammar feeds into. The plugin applies
// its own `basicLight` theme *after* these, so we raise precedence to keep the
// dark surface and palette from being overridden.
export const CODE_BLOCK_EDITOR_EXTENSIONS: Extension[] = [
  Prec.highest([editorTheme, syntaxHighlighting(highlightStyle)]),
];
