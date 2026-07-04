import { syntaxTree } from "@codemirror/language";
import { EditorSelection, StateField } from "@codemirror/state";
import type { EditorState, Extension, Range } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from "@codemirror/view";
import {
  getEffectiveSelectionRanges,
  isSelectionDecorationFrozen,
} from "./selection-freeze";

const hiddenMarkdownToken = Decoration.replace({});
const headingMark = Decoration.mark({ class: "cm-md-heading-mark" });
const strongMark = Decoration.mark({ class: "cm-md-strong" });
const emphasisMark = Decoration.mark({ class: "cm-md-emphasis" });
const strikeMark = Decoration.mark({ class: "cm-md-strike" });
const inlineCodeMark = Decoration.mark({ class: "cm-md-inline-code" });
const linkMark = Decoration.mark({ class: "cm-md-link" });
const listLine = Decoration.line({ attributes: { class: "cm-md-list-line" } });
const tableLine = Decoration.line({ attributes: { class: "cm-md-table-line" } });

const headingLineDecorations = new Map<number, Decoration>(
  [1, 2, 3, 4, 5, 6].map((level) => [
    level,
    Decoration.line({
      attributes: { class: `cm-md-heading cm-md-heading-${level}` },
    }),
  ]),
);

const quoteLineDecorations = createBlockLineDecorations("cm-md-quote-line");
const codeLineDecorations = createBlockLineDecorations("cm-md-code-line");

class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const element = document.createElement("div");
    element.className = "cm-md-hr-widget";
    return element;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class ImageWidget extends WidgetType {
  constructor(
    private readonly src: string,
    private readonly alt: string,
  ) {
    super();
  }

  eq(widget: ImageWidget): boolean {
    return this.src === widget.src && this.alt === widget.alt;
  }

  toDOM(): HTMLElement {
    const figure = document.createElement("figure");
    const image = document.createElement("img");
    figure.className = "cm-md-image-widget";
    image.src = this.src;
    image.alt = this.alt;
    figure.append(image);
    return figure;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

const horizontalRuleWidget = Decoration.replace({
  block: true,
  widget: new HorizontalRuleWidget(),
});

function createBlockLineDecorations(baseClass: string) {
  return {
    first: Decoration.line({
      attributes: { class: `${baseClass} ${baseClass}-first` },
    }),
    last: Decoration.line({
      attributes: { class: `${baseClass} ${baseClass}-last` },
    }),
    middle: Decoration.line({
      attributes: { class: baseClass },
    }),
    single: Decoration.line({
      attributes: {
        class: `${baseClass} ${baseClass}-first ${baseClass}-last`,
      },
    }),
  };
}

function selectionTouchesRange(
  state: EditorState,
  from: number,
  to: number,
): boolean {
  return getEffectiveSelectionRanges(state).some(
    (range) => range.from <= to && from <= range.to,
  );
}

function shouldHideNode(state: EditorState, from: number, to: number): boolean {
  return !selectionTouchesRange(state, from, to);
}

function addLineDecorationForRange(
  state: EditorState,
  ranges: Range<Decoration>[],
  from: number,
  to: number,
  decoration: Decoration,
) {
  addBlockLineDecorationsForRange(state, ranges, from, to, {
    first: decoration,
    last: decoration,
    middle: decoration,
    single: decoration,
  });
}

function addBlockLineDecorationsForRange(
  state: EditorState,
  ranges: Range<Decoration>[],
  from: number,
  to: number,
  decorations: {
    first: Decoration;
    last: Decoration;
    middle: Decoration;
    single: Decoration;
  },
) {
  let line = state.doc.lineAt(from);
  const firstLineNumber = line.number;
  const lastLine = state.doc.lineAt(Math.max(from, to > from ? to - 1 : to));

  while (line.number <= lastLine.number) {
    const decoration =
      line.number === lastLine.number
        ? line.number === firstLineNumber
          ? decorations.single
          : decorations.last
        : line.number === firstLineNumber
          ? decorations.first
          : decorations.middle;
    ranges.push(decoration.range(line.from));
    if (line.number === lastLine.number) break;
    line = state.doc.line(line.number + 1);
  }
}

function createListMarkerDecoration(
  source: string,
  taskListItem: boolean,
): Decoration {
  return Decoration.mark({
    class: taskListItem
      ? "cm-md-task-list-marker"
      : /^\d/.test(source)
        ? "cm-md-ordered-list-marker"
        : "cm-md-bullet-list-marker",
  });
}

function isTaskListMark(state: EditorState, markerTo: number): boolean {
  const line = state.doc.lineAt(markerTo);
  return /^[ \t]\[[ xX]\]/.test(state.doc.sliceString(markerTo, line.to));
}

function createTaskMarkerDecoration(source: string): Decoration {
  return Decoration.mark({
    class: /\[[xX]\]/.test(source)
      ? "cm-md-task-marker-source is-checked"
      : "cm-md-task-marker-source",
  });
}

function parseImageMarkdown(
  source: string,
): { alt: string; src: string } | null {
  const match = source.match(
    /^!\[([^\]\n]*)]\((\S+?)(?:\s+["'][^"']*["'])?\)$/,
  );
  if (!match?.[2]) return null;
  return { alt: match[1] ?? "", src: match[2] };
}

function buildMarkdownDecorations(state: EditorState): DecorationSet {
  const ranges: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter(node) {
      const name = node.name;
      const parent = node.node.parent;
      const parentFrom = parent?.from ?? node.from;
      const parentTo = parent?.to ?? node.to;

      if (name.startsWith("ATXHeading")) {
        const level = Number(name.replace("ATXHeading", ""));
        const decoration = headingLineDecorations.get(level);
        if (decoration) {
          ranges.push(decoration.range(state.doc.lineAt(node.from).from));
        }
        return;
      }

      if (name === "HeaderMark" && parent?.name.startsWith("ATXHeading")) {
        ranges.push(
          headingMark.range(node.from, Math.min(node.to + 1, parentTo)),
        );
        return;
      }

      if (name === "Blockquote") {
        addBlockLineDecorationsForRange(
          state,
          ranges,
          node.from,
          node.to,
          quoteLineDecorations,
        );
        return;
      }

      if (name === "FencedCode") {
        addBlockLineDecorationsForRange(
          state,
          ranges,
          node.from,
          node.to,
          codeLineDecorations,
        );
        return;
      }

      if (name === "ListItem") {
        addLineDecorationForRange(state, ranges, node.from, node.to, listLine);
        return;
      }

      if (name === "Table" || name === "TableHeader" || name === "TableRow") {
        addLineDecorationForRange(state, ranges, node.from, node.to, tableLine);
        return;
      }

      if (name === "HorizontalRule") {
        const line = state.doc.lineAt(node.from);
        ranges.push(horizontalRuleWidget.range(line.from, line.to));
        return false;
      }

      if (name === "StrongEmphasis") {
        ranges.push(strongMark.range(node.from, node.to));
        return;
      }

      if (name === "Emphasis") {
        ranges.push(emphasisMark.range(node.from, node.to));
        return;
      }

      if (name === "Strikethrough") {
        ranges.push(strikeMark.range(node.from, node.to));
        return;
      }

      if (name === "InlineCode") {
        ranges.push(inlineCodeMark.range(node.from, node.to));
        return;
      }

      if (name === "Link") {
        ranges.push(linkMark.range(node.from, node.to));
        return;
      }

      if (name === "Image") {
        const source = state.doc.sliceString(node.from, node.to);
        const line = state.doc.lineAt(node.from);
        const image = parseImageMarkdown(source);
        if (image && line.text.trim() === source) {
          ranges.push(
            Decoration.replace({
              block: true,
              widget: new ImageWidget(image.src, image.alt),
            }).range(line.from, line.to),
          );
          return false;
        }
        return;
      }

      if (name === "ListMark" && parent?.name === "ListItem") {
        ranges.push(
          createListMarkerDecoration(
            state.doc.sliceString(node.from, node.to),
            isTaskListMark(state, node.to),
          ).range(node.from, node.to),
        );
        return;
      }

      if (name === "TaskMarker" && parent?.name === "Task") {
        ranges.push(
          createTaskMarkerDecoration(
            state.doc.sliceString(node.from, node.to),
          ).range(node.from, node.to),
        );
        return;
      }

      if (
        name === "EmphasisMark" ||
        name === "StrikethroughMark" ||
        name === "QuoteMark" ||
        name === "LinkMark" ||
        (name === "CodeMark" && parent?.name === "InlineCode") ||
        (name === "URL" &&
          (parent?.name === "Link" || parent?.name === "Image"))
      ) {
        if (shouldHideNode(state, parentFrom, parentTo)) {
          ranges.push(hiddenMarkdownToken.range(node.from, node.to));
        }
      }
    },
  });

  return Decoration.set(ranges, true);
}

const markdownDecorationField = StateField.define<DecorationSet>({
  create: buildMarkdownDecorations,
  update(decorations, transaction) {
    if (isSelectionDecorationFrozen(transaction.state)) {
      return transaction.docChanged
        ? decorations.map(transaction.changes)
        : decorations;
    }

    if (
      transaction.docChanged ||
      transaction.selection ||
      syntaxTree(transaction.startState) !== syntaxTree(transaction.state)
    ) {
      return buildMarkdownDecorations(transaction.state);
    }
    return decorations.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const blockWidgetSelectionHandler = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target;
    if (!(target instanceof Element)) return false;
    if (!target.closest(".cm-md-hr-widget, .cm-md-image-widget")) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    const line = view.state.doc.lineAt(pos);
    event.preventDefault();
    event.stopPropagation();
    view.dispatch({
      selection: EditorSelection.range(line.from, line.to),
      scrollIntoView: false,
      userEvent: "select.block-widget",
    });
    view.focus();
    return true;
  },
});

const markdownDecorationTheme = EditorView.theme({
  ".cm-md-strong": {
    fontWeight: "800",
  },
  ".cm-md-emphasis": {
    fontStyle: "italic",
  },
  ".cm-md-strike": {
    textDecoration: "line-through",
  },
  ".cm-md-inline-code": {
    direction: "ltr",
    margin: "0 2px",
    padding: "0.08em 0.42em",
    border: "1px solid var(--reader-code-border)",
    borderRadius: "4px",
    background: "var(--reader-code)",
    color: "var(--reader-code-text)",
    fontFamily: "var(--reader-font)",
    fontSize: "0.92em",
    lineHeight: "inherit",
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  },
  ".cm-md-link": {
    color: "inherit",
    borderBottom: "1px dotted var(--reader-soft)",
    boxShadow: "none",
    textDecoration: "none",
  },
  ".cm-md-heading": {
    color: "var(--reader-ink)",
    fontFamily: "var(--reader-font)",
    fontWeight: "800",
    position: "relative",
    textWrap: "balance",
  },
  ".cm-md-heading-mark": {
    position: "absolute",
    right: "100%",
    paddingRight: "0.4em",
    color: "var(--reader-muted)",
    whiteSpace: "pre",
    pointerEvents: "auto",
    fontSize: "inherit",
    fontWeight: "inherit",
  },
  ".cm-md-heading-1": {
    padding: "30px 0 16px",
    fontSize: "28.9px",
    lineHeight: "1.3",
  },
  ".cm-md-heading-2": {
    padding: "36px 0 16px",
    fontSize: "27.2px",
    lineHeight: "1.32",
  },
  ".cm-md-heading-3": {
    padding: "24px 0 14px",
    fontSize: "21.25px",
    lineHeight: "1.35",
  },
  ".cm-md-heading-4": {
    padding: "24px 0 14px",
    fontSize: "18.7px",
    lineHeight: "1.35",
  },
  ".cm-md-heading-5": {
    padding: "24px 0 14px",
    fontSize: "16.15px",
    lineHeight: "1.35",
  },
  ".cm-md-heading-6": {
    padding: "24px 0 14px",
    fontSize: "14.45px",
    lineHeight: "1.35",
  },
  ".cm-md-list-line": {
    paddingInlineStart: "25px",
    fontSize: "16.15px",
    lineHeight: "1.72",
    textIndent: "-25px",
  },
  ".cm-md-bullet-list-marker": {
    display: "inline-block",
    position: "relative",
    minWidth: "1em",
    color: "transparent",
    textAlign: "center",
    textIndent: "0",
  },
  ".cm-md-bullet-list-marker::before": {
    position: "absolute",
    inset: "0",
    color: "var(--reader-ink)",
    content: '"•"',
  },
  ".cm-md-ordered-list-marker": {
    display: "inline-block",
    minWidth: "1.35em",
    color: "var(--reader-ink)",
    textIndent: "0",
  },
  ".cm-md-task-list-marker": {
    display: "inline-block",
    overflow: "hidden",
    width: "0",
    color: "transparent",
    textIndent: "0",
  },
  ".cm-md-task-marker-source": {
    display: "inline-block",
    position: "relative",
    width: "0.92em",
    height: "0.92em",
    margin: "0 0.3em 0 0.1em",
    color: "transparent",
    transform: "translateY(0.08em)",
  },
  ".cm-md-task-marker-source::before": {
    position: "absolute",
    inset: "0",
    boxSizing: "border-box",
    border: "1px solid color-mix(in srgb, var(--reader-soft) 70%, transparent)",
    borderRadius: "3px",
    content: '""',
  },
  ".cm-md-task-marker-source.is-checked::before": {
    borderColor: "var(--reader-ink)",
    background:
      "linear-gradient(var(--reader-ink), var(--reader-ink)) center / 62% 2px no-repeat",
  },
  ".cm-md-quote-line": {
    borderInlineStart: "4px solid var(--reader-soft)",
    color: "var(--reader-muted)",
    paddingInlineStart: "16px",
  },
  ".cm-md-quote-line-first": {
    paddingTop: "22px",
  },
  ".cm-md-quote-line-last": {
    paddingBottom: "22px",
  },
  ".cm-md-code-line": {
    paddingInline: "18px",
    background: "rgb(21, 20, 27) !important",
    color: "rgb(237, 236, 238)",
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    fontSize: "12px",
    lineHeight: "1.75",
    whiteSpace: "pre",
  },
  ".cm-md-code-line-first": {
    marginTop: "12px",
    paddingTop: "14px",
    borderTopLeftRadius: "var(--radius)",
    borderTopRightRadius: "var(--radius)",
  },
  ".cm-md-code-line-last": {
    marginBottom: "20px",
    paddingBottom: "14px",
    borderBottomRightRadius: "var(--radius)",
    borderBottomLeftRadius: "var(--radius)",
  },
  ".cm-md-table-line": {
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: "14.45px",
    lineHeight: "1.45",
  },
  ".cm-md-horizontal-rule": {
    color: "color-mix(in srgb, var(--reader-ink) 35%, transparent)",
  },
  ".cm-md-hr-widget": {
    height: "1px",
    margin: "34px 0",
    background: "color-mix(in srgb, var(--reader-soft) 55%, transparent)",
  },
  ".cm-md-image-widget": {
    margin: "24px 0",
  },
  ".cm-md-image-widget img": {
    display: "block",
    maxWidth: "100%",
    height: "auto",
    borderRadius: "6px",
  },
});

export function markdownDecorations(enabled: boolean): Extension {
  return enabled
    ? [
        markdownDecorationField,
        markdownDecorationTheme,
        blockWidgetSelectionHandler,
      ]
    : [];
}
