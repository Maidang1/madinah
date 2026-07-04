import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownKeymap } from "@codemirror/lang-markdown";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { search, searchKeymap } from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import { Prec } from "@codemirror/state";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
} from "@codemirror/view";
import { GFM } from "@lezer/markdown";
import {
  CODE_BLOCK_LANGUAGES,
  type CodeBlockLanguage,
} from "../../engine/codeBlockLanguages";
import { markdownDecorations } from "./markdown-decorations";
import type { MarkdownEditorMode, MarkdownEditorSyntax } from "./profile";
import { selectionFreezeExtension } from "./selection-freeze";

interface CreateWriterCodeMirrorExtensionsInput {
  mode: MarkdownEditorMode;
  syntax: MarkdownEditorSyntax;
  updateListener: Extension;
  pasteHandlers: Extension;
}

export function createWriterCodeMirrorExtensions({
  mode,
  syntax,
  updateListener,
  pasteHandlers,
}: CreateWriterCodeMirrorExtensionsInput): Extension[] {
  const richText = mode === "rich-text";

  return [
    highlightSpecialChars(),
    history(),
    dropCursor(),
    drawSelection(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    markdown({
      codeLanguages: resolveCodeBlockLanguage,
      extensions: syntax === "commonmark" ? [] : [GFM],
    }),
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    writerEditorTheme,
    selectionFreezeExtension(richText),
    markdownDecorations(richText),
    search({ literal: true }),
    highlightActiveLine(),
    EditorView.lineWrapping,
    pasteHandlers,
    updateListener,
    Prec.highest(
      keymap.of([
        ...markdownKeymap,
        ...closeBracketsKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        ...foldKeymap,
        indentWithTab,
      ]),
    ),
  ];
}

function resolveCodeBlockLanguage(info: string) {
  const token = info.trim().split(/\s+/, 1)[0]?.toLowerCase();
  if (!token) return null;

  const language = CODE_BLOCK_LANGUAGES.find((candidate) =>
    matchesCodeBlockLanguage(candidate, token),
  );
  return language?.support?.extension.language ?? null;
}

function matchesCodeBlockLanguage(
  language: CodeBlockLanguage,
  token: string,
): boolean {
  return language.alias?.some((alias) => alias.toLowerCase() === token) ?? false;
}

const writerEditorTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--reader-ink)",
    fontFamily: "var(--reader-font)",
    minHeight: "100%",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflow: "visible",
    fontFamily: "inherit",
  },
  ".cm-content": {
    caretColor: "var(--reader-ink)",
    color: "var(--reader-ink)",
    fontFamily: "inherit",
    fontSize: "16.15px",
    letterSpacing: "0.42px",
    lineHeight: "1.76",
    minHeight: "46vh",
    padding: "0 0 140px",
    textAutospace: "ideograph-alpha ideograph-numeric",
  },
  ".cm-line": {
    minHeight: "1.76em",
    padding: "0",
    lineHeight: "inherit",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--reader-ink)",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection":
    {
      backgroundColor:
        "color-mix(in srgb, var(--writer-focus) 22%, transparent)",
    },
  ".cm-activeLine": {
    backgroundColor: "transparent",
  },
  ".cm-panels": {
    display: "none",
  },
  ".cm-gutters": {
    display: "none",
  },
});
