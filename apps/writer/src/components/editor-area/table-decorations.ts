import { type EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import {
  foldableSyntaxFacet,
  selectAllDecorationsOnSelectExtension,
} from "@/lib/prosemark-core/main";
import { SETTINGS_SCHEMA } from "@/lib/settings-schema";
import {
  parseInlineMarkdown,
  setInlineMarkdownContent,
  type MarkdownInlineNode,
} from "@/lib/markdown-inline-renderer";

export { parseInlineMarkdown as parseTableCellInlineMarkdown };
export type { MarkdownInlineNode as TableCellInlineNode };

const fallbackMonospaceCodeFont =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
const codeFontFamily = `var(--pm-code-font, ${fallbackMonospaceCodeFont})`;

const tableCellLineHeight = 1.4;
const tableCellVerticalPaddingEm = 1;
const tableWidgetVerticalPaddingEm = 0.5;
const tableBorderWidthPx = 1;

function numericSettingDefault(key: string, fallback: number): number {
  const def = SETTINGS_SCHEMA.find((entry) => entry.key === key);
  return typeof def?.default === "number" ? def.default : fallback;
}

const defaultEditorFontSizePx = numericSettingDefault("editor.font-size", 16);

type Alignment = "left" | "center" | "right";

interface ParsedTable {
  headers: string[];
  alignments: (Alignment | undefined)[];
  rows: string[][];
}

function isEscapedAt(text: string, index: number): boolean {
  let backslashes = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i--) {
    backslashes++;
  }
  return backslashes % 2 === 1;
}

function parseCells(line: string): string[] {
  const trimmed = line.trim();
  const start = trimmed.startsWith("|") ? 1 : 0;
  const end =
    trimmed.endsWith("|") && !isEscapedAt(trimmed, trimmed.length - 1)
      ? trimmed.length - 1
      : trimmed.length;
  const cells: string[] = [];
  let current = "";
  let escaped = false;

  for (let i = start; i < end; i++) {
    const char = trimmed[i];
    if (char === "|" && !escaped) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
    escaped = !escaped && char === "\\";
  }

  cells.push(current.trim());
  return cells;
}

function parseAlignment(cell: string): Alignment | undefined {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return undefined;
}

function parseMarkdownTable(text: string): ParsedTable | undefined {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return undefined;

  const headers = parseCells(lines[0]);
  const delimiterCells = parseCells(lines[1]);

  const isDelimiter = delimiterCells.every((c) => /^:?-+:?$/.test(c));
  if (!isDelimiter) return undefined;

  const alignments = delimiterCells.map(parseAlignment);
  const rows = lines.slice(2).map(parseCells);

  return { headers, alignments, rows };
}

function estimateTableWidgetHeight(table: ParsedTable): number {
  const visualRows = 1 + table.rows.length;
  const rowHeight = defaultEditorFontSizePx * (tableCellLineHeight + tableCellVerticalPaddingEm);
  const wrapperPadding = defaultEditorFontSizePx * tableWidgetVerticalPaddingEm;
  const horizontalBorders = Math.max(0, visualRows + 1) * tableBorderWidthPx;

  return Math.ceil(wrapperPadding + visualRows * rowHeight + horizontalBorders);
}

function tableSourceLineClass(isFirst: boolean, isLast: boolean): string {
  let className = "cm-table-source-line";
  if (isFirst) className += " cm-table-source-line-first";
  if (isLast) className += " cm-table-source-line-last";
  return className;
}

function buildTableSourceLineDecorations(
  state: EditorState,
  node: { from: number; to: number },
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  const firstLine = state.doc.lineAt(node.from);

  for (let pos = firstLine.from; pos <= node.to; ) {
    const line = state.doc.lineAt(pos);
    const isFirst = line.from === firstLine.from;
    const isLast = line.to >= node.to;

    decorations.push(
      Decoration.line({ class: tableSourceLineClass(isFirst, isLast) }).range(line.from),
    );

    if (isLast) break;
    pos = line.to + 1;
  }

  return decorations;
}

// --- Widget ---

class TableWidget extends WidgetType {
  constructor(
    readonly table: ParsedTable,
    readonly rawText: string,
    private readonly heightEstimate: number,
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return this.rawText === other.rawText;
  }

  ignoreEvent(): boolean {
    return false;
  }

  get estimatedHeight(): number {
    return this.heightEstimate;
  }

  toDOM(): HTMLElement {
    const { headers, alignments, rows } = this.table;

    const wrapper = document.createElement("div");
    wrapper.className = "cm-table-widget";

    const inner = wrapper.appendChild(document.createElement("div"));
    inner.className = "cm-table-inner";
    const tableEl = inner.appendChild(document.createElement("table"));

    const thead = tableEl.appendChild(document.createElement("thead"));
    const headerRow = thead.appendChild(document.createElement("tr"));
    for (let i = 0; i < headers.length; i++) {
      const th = headerRow.appendChild(document.createElement("th"));
      setInlineMarkdownContent(th, headers[i]);
      const a = alignments[i];
      if (a) th.style.textAlign = a;
    }

    const tbody = tableEl.appendChild(document.createElement("tbody"));
    for (let r = 0; r < rows.length; r++) {
      const tr = tbody.appendChild(document.createElement("tr"));
      for (let c = 0; c < headers.length; c++) {
        const td = tr.appendChild(document.createElement("td"));
        setInlineMarkdownContent(td, rows[r][c] ?? "");
        const a = alignments[c];
        if (a) td.style.textAlign = a;
      }
    }

    return wrapper;
  }

  updateDOM(dom: HTMLElement): boolean {
    const { headers, alignments, rows } = this.table;

    const existingThs = dom.querySelectorAll<HTMLElement>("thead th");
    const existingTrs = dom.querySelectorAll("tbody tr");
    if (existingThs.length !== headers.length || existingTrs.length !== rows.length) return false;

    existingThs.forEach((th, i) => {
      setInlineMarkdownContent(th, headers[i]);
      th.style.textAlign = alignments[i] ?? "";
    });

    existingTrs.forEach((tr, rowIdx) => {
      tr.querySelectorAll<HTMLElement>("td").forEach((td, colIdx) => {
        setInlineMarkdownContent(td, rows[rowIdx]?.[colIdx] ?? "");
        td.style.textAlign = alignments[colIdx] ?? "";
      });
    });

    return true;
  }
}

// --- Extensions ---

const tableFoldExtension = foldableSyntaxFacet.of({
  nodePath: "Table",
  keepDecorationOnUnfold: true,
  buildDecorations: (state, node, selectionTouchesRange) => {
    const text = state.doc.sliceString(node.from, node.to);
    const parsed = parseMarkdownTable(text);
    if (!parsed) return undefined;

    if (selectionTouchesRange) {
      return buildTableSourceLineDecorations(state, node);
    }

    return Decoration.replace({
      widget: new TableWidget(parsed, text, estimateTableWidgetHeight(parsed)),
      block: true,
      inclusiveStart: true,
    }).range(node.from, node.to);
  },
});

const tableTheme = EditorView.baseTheme({
  ".cm-table-widget": {
    padding: `${tableWidgetVerticalPaddingEm / 2}em 0`,
  },
  ".cm-table-inner": {
    display: "inline-block",
  },
  ".cm-table-widget table": {
    borderCollapse: "separate",
    borderSpacing: "0",
    border: `${tableBorderWidthPx}px solid var(--border-color, #3e3e42)`,
    borderRadius: "8px",
    overflow: "hidden",
    fontFamily: "inherit",
    fontSize: "inherit",
    width: "auto",
  },
  ".cm-table-widget th, .cm-table-widget td": {
    padding: `${tableCellVerticalPaddingEm / 2}em 0.8em`,
    minWidth: "6em",
    fontSize: "inherit",
    lineHeight: `${tableCellLineHeight}`,
    borderBottom: `${tableBorderWidthPx}px solid var(--border-color, #3e3e42)`,
    borderRight: `${tableBorderWidthPx}px solid var(--border-color, #3e3e42)`,
  },
  ".cm-table-widget th:last-child, .cm-table-widget td:last-child": {
    borderRight: "none",
  },
  ".cm-table-widget tbody tr:last-child td": {
    borderBottom: "none",
  },
  ".cm-table-widget th": {
    fontWeight: "600",
    backgroundColor: "var(--surface-subtle, var(--code-bg, #2d2d2d))",
  },
  ".cm-table-source-line": {
    display: "block",
    marginLeft: "0",
    paddingLeft: "12px",
    paddingRight: "12px",
    backgroundColor: "var(--pm-code-background-color)",
    fontFamily: codeFontFamily,
    fontVariantLigatures: "none",
    fontFeatureSettings: '"calt" 0',
    fontKerning: "none",
  },
  ".cm-activeLine.cm-table-source-line": {
    backgroundColor: "var(--pm-code-background-color)",
  },
  ".cm-table-source-line-first": {
    borderTopLeftRadius: "0.4rem",
    borderTopRightRadius: "0.4rem",
  },
  ".cm-table-source-line-last": {
    borderBottomLeftRadius: "0.4rem",
    borderBottomRightRadius: "0.4rem",
  },
});

const foldTreeSync = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate) {
      if (!update.docChanged && syntaxTree(update.state) !== syntaxTree(update.startState)) {
        setTimeout(() => {
          update.view.dispatch({ selection: update.view.state.selection });
        });
      }
    }
  },
);

export function tableDecorations() {
  return [
    tableFoldExtension,
    tableTheme,
    foldTreeSync,
    selectAllDecorationsOnSelectExtension("cm-table-widget"),
  ];
}
