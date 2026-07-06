import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import {
  Decoration,
  type EditorView,
  ViewPlugin,
  type ViewUpdate,
  type WidgetType,
} from "@codemirror/view";
import { foldableSyntaxFacet } from "@/lib/prosemark-core/main";

interface FencedCodeChild {
  name: string;
  from: number;
  to: number;
  nextSibling: FencedCodeChild | null;
}

interface FencedCodeNode {
  from: number;
  to: number;
  node: {
    firstChild: FencedCodeChild | null;
  };
}

interface FencedCodeState {
  doc: {
    sliceString(from: number, to: number): string;
  };
}

export interface FencedCodeBlock {
  info: string;
  source: string;
  fenceText: string;
  from: number;
  to: number;
}

export interface FencedCodeRenderer {
  matches: (info: string) => boolean;
  createWidget: (block: FencedCodeBlock) => WidgetType | null;
}

export function findEnclosingFencedCode(view: EditorView, host: HTMLElement) {
  const pos = view.posAtDOM(host);
  const tree = syntaxTree(view.state);
  for (const side of [-1, 1] as const) {
    let node = tree.resolveInner(pos, side);
    while (node.name !== "FencedCode" && node.parent) node = node.parent;
    if (node.name === "FencedCode") return node;
  }
  return null;
}

function parseFencedCode(state: FencedCodeState, node: FencedCodeNode): FencedCodeBlock | null {
  let info = "";
  let source = "";

  let child = node.node.firstChild;
  while (child) {
    if (child.name === "CodeInfo") {
      info = state.doc.sliceString(child.from, child.to);
    } else if (child.name === "CodeText") {
      source += state.doc.sliceString(child.from, child.to);
    }
    child = child.nextSibling;
  }

  if (!info) return null;
  return {
    info,
    source,
    fenceText: state.doc.sliceString(node.from, node.to),
    from: node.from,
    to: node.to,
  };
}

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

export function createFencedCodeRendererExtension(
  renderers: readonly FencedCodeRenderer[],
): Extension[] {
  const foldExtension = foldableSyntaxFacet.of({
    nodePath: "FencedCode",
    keepDecorationOnUnfold: true,
    buildDecorations: (state, node) => {
      const block = parseFencedCode(state, node);
      if (!block) return undefined;

      for (const renderer of renderers) {
        if (!renderer.matches(block.info)) continue;

        const widget = renderer.createWidget(block);
        if (!widget) return undefined;
        return Decoration.replace({ widget, block: true, inclusiveStart: true }).range(
          block.from,
          block.to,
        );
      }

      return undefined;
    },
  });

  return [foldExtension, foldTreeSync];
}
