import { Decoration, EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { EditorSelection, RangeSetBuilder } from "@codemirror/state";
import type { DecorationSet } from "@codemirror/view";
import { type Extension } from "@codemirror/state";
import { isFrontmatterNode } from "./markdown/frontmatter";

const fallbackMonospaceCodeFont =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
const codeFontFamily = `var(--pm-code-font, ${fallbackMonospaceCodeFont})`;
const codeBlockFontSize = "var(--writer-code-block-font-size, 14px)";
const codeBlockLineHeight = "var(--writer-code-block-line-height, 1.75)";
const clickDragTolerancePx = 4;

interface PendingCodeFenceClick {
  line: HTMLElement;
  x: number;
  y: number;
}

const codeBlockDecorations = (view: EditorView) => {
  const builder = new RangeSetBuilder<Decoration>();

  // If there are multiple visible ranges, it's possible to see
  // the same code block multiple times
  const visited = new Set<string>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        const isFencedCode = node.name === "FencedCode";
        const isFrontmatter = isFrontmatterNode(node);

        if (isFencedCode || isFrontmatter) {
          const key = JSON.stringify([node.from, node.to]);
          if (visited.has(key)) return;
          visited.add(key);

          for (let pos = node.from; pos <= node.to; ) {
            const line = view.state.doc.lineAt(pos);
            const isFirstLine = pos === node.from;
            const isLastLine = line.to >= node.to;

            builder.add(
              line.from,
              line.from,
              Decoration.line({
                class: `cm-fenced-code-line ${
                  isFirstLine ? "cm-fenced-code-line-first" : ""
                } ${isLastLine ? "cm-fenced-code-line-last" : ""}`,
              }),
            );

            pos = line.to + 1;
          }
        }
      },
    });
  }

  return builder.finish();
};

export const codeBlockDecorationsExtension: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = codeBlockDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = codeBlockDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

function closestFencedCodeLine(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>(".cm-fenced-code-line") : null;
}

function caretFromPoint(doc: Document, x: number, y: number) {
  if ("caretPositionFromPoint" in doc) {
    const position = doc.caretPositionFromPoint(x, y);
    if (position) return { node: position.offsetNode, offset: position.offset };
  }

  if ("caretRangeFromPoint" in doc) {
    const range = doc.caretRangeFromPoint(x, y);
    if (range) return { node: range.startContainer, offset: range.startOffset };
  }

  return null;
}

function codeFencePosAtPoint(view: EditorView, line: HTMLElement, x: number, y: number) {
  const caret = caretFromPoint(line.ownerDocument, x, y);
  if (!caret || !line.contains(caret.node)) return null;

  try {
    return view.posAtDOM(caret.node, caret.offset);
  } catch {
    return null;
  }
}

export const codeFenceClickSelectionExtension: Extension = ViewPlugin.fromClass(
  class {
    private pending: PendingCodeFenceClick | null = null;

    start(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) {
        this.pending = null;
        return;
      }

      const line = closestFencedCodeLine(event.target);
      this.pending = line ? { line, x: event.clientX, y: event.clientY } : null;
    }

    finish(event: MouseEvent, view: EditorView) {
      const pending = this.pending;
      this.pending = null;
      if (!pending) return false;
      if (Math.abs(event.clientX - pending.x) > clickDragTolerancePx) return false;
      if (Math.abs(event.clientY - pending.y) > clickDragTolerancePx) return false;

      const line = closestFencedCodeLine(event.target);
      if (line !== pending.line) return false;

      const pos = codeFencePosAtPoint(view, line, event.clientX, event.clientY);
      if (pos === null) return false;

      view.focus();
      view.dispatch({
        selection: EditorSelection.cursor(pos),
        userEvent: "select.pointer",
        scrollIntoView: false,
      });
      return true;
    }

    cancel() {
      this.pending = null;
    }
  },
  {
    eventHandlers: {
      mousedown(event) {
        this.start(event);
        return false;
      },
      mouseup(event, view) {
        return this.finish(event, view);
      },
      blur() {
        this.cancel();
        return false;
      },
    },
  },
);

const codeFenceThemeSpec = {
  ".cm-fenced-code-line": {
    display: "block",
    marginLeft: "6px",
    backgroundColor: "var(--pm-code-background-color)",
    fontFamily: codeFontFamily,
    fontSize: codeBlockFontSize,
    lineHeight: codeBlockLineHeight,
    fontVariantLigatures: "none",
    fontFeatureSettings: '"calt" 0',
    fontKerning: "none",
  },
  // In case the active line color changes
  ".cm-activeLine.cm-fenced-code-line": {
    backgroundColor: "var(--pm-code-background-color)",
  },
  ".cm-fenced-code-line-first": {
    borderTopLeftRadius: "0.4rem",
    borderTopRightRadius: "0.4rem",
  },
  ".cm-fenced-code-line-last": {
    borderBottomLeftRadius: "0.4rem",
    borderBottomRightRadius: "0.4rem",
  },
};

export const codeFenceTheme = EditorView.theme(codeFenceThemeSpec);

export const __testCodeFenceExtension = {
  codeFenceThemeSpec,
};
