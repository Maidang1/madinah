import { EditorView, WidgetType } from "@codemirror/view";
import { renderMermaid } from "./mermaid-renderer";
import { MERMAID_CANVAS_HEIGHT, MermaidCanvasHandle, mountMermaidCanvas } from "./mermaid-canvas";
import { openMermaidFullscreen } from "./mermaid-fullscreen";
import {
  createFencedCodeRendererExtension,
  findEnclosingFencedCode,
  type FencedCodeBlock,
} from "./fenced-code-renderers";
import "./mermaid-canvas.css";

// Outer widget padding (top + bottom). `mermaid-canvas.css` splits this
// evenly across top/bottom so `estimatedHeight` matches the rendered box.
const WIDGET_VERTICAL_PADDING = 16;

// Map keyed by wrapper DOM element so `updateDOM` and `destroy` can find the
// live canvas handle without round-tripping through CodeMirror state. Weak so
// disposed wrappers don't leak.
const widgetHandles = new WeakMap<HTMLElement, MermaidCanvasHandle>();

/**
 * Mermaid widget. Identity is `(body, fenceText)` — the body drives the SVG
 * cache and the fence text drives the inline editor's content. The Edit-code
 * toggle lives entirely inside the canvas frame, so it never participates in
 * widget identity and a toggle never triggers a CodeMirror rebuild.
 */
class MermaidWidget extends WidgetType {
  constructor(
    readonly body: string,
    readonly fenceText: string,
  ) {
    super();
  }

  eq(other: MermaidWidget): boolean {
    return this.body === other.body && this.fenceText === other.fenceText;
  }

  // Fixed height regardless of diagram size, so the heightmap settles on a
  // stable value immediately.
  get estimatedHeight(): number {
    return MERMAID_CANVAS_HEIGHT + WIDGET_VERTICAL_PADDING;
  }

  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "cm-mermaid-widget";
    wrapper.contentEditable = "false";

    const host = document.createElement("div");
    host.className = "cm-mermaid-canvas";
    host.tabIndex = 0;
    wrapper.append(host);

    const ariaLabel = `Mermaid diagram: ${this.body.split("\n")[0]}`;
    const onExpand = () => openMermaidFullscreen(this.body, ariaLabel);
    const onSourceChange = (next: string) => writeFenceText(view, host, next);

    // Synchronous render. beautiful-mermaid is sync and the SVG cache makes
    // repeat calls O(map lookup), so the wrapper paints with its final SVG in
    // the same frame it enters the DOM — no IntersectionObserver, no async
    // gap that can leave the user stuck on a placeholder.
    const result = renderMermaid(this.body);
    const handle = mountMermaidCanvas(host, {
      svgHtml: result.svg ?? "",
      ariaLabel,
      source: this.fenceText,
      onSourceChange,
      onExpand,
    });
    if (result.error) handle.updateSource("", this.fenceText, result.error);
    widgetHandles.set(wrapper, handle);

    return wrapper;
  }

  // Called when the new widget isn't `eq` to the old one but CM is willing to
  // reuse the existing DOM. Returning `true` keeps the DOM (and the nested
  // editor's focus, selection, scroll, history) intact across source changes.
  updateDOM(dom: HTMLElement, _view: EditorView): boolean {
    const handle = widgetHandles.get(dom);
    if (!handle) return false;
    const result = renderMermaid(this.body);
    handle.updateSource(result.svg ?? "", this.fenceText, result.error);
    return true;
  }

  destroy(dom: HTMLElement): void {
    const handle = widgetHandles.get(dom);
    handle?.destroy();
    widgetHandles.delete(dom);
  }

  ignoreEvent(): boolean {
    // The canvas owns all pointer/keyboard interaction inside the widget.
    // Without this CodeMirror would also process clicks and try to place the
    // caret at the replaced range, hijacking the toggle and zoom buttons.
    return true;
  }
}

/**
 * Dispatch a transaction on the outer view replacing the *entire fence*
 * (opening marker, info string, body, closing marker) with `next`. Position
 * is resolved live from the syntax tree at call time, so it stays correct
 * even as text above the fence shifts.
 *
 * If the user breaks the fence syntax mid-edit (e.g. they delete the closing
 * ```), the parser stops recognizing it as a FencedCode on the next rebuild
 * and the widget collapses to raw markdown — that's the natural consequence
 * of editing the full fence, and the user can recover by completing the
 * fence again.
 */
function writeFenceText(view: EditorView, host: HTMLElement, next: string): void {
  const fence = findEnclosingFencedCode(view, host);
  if (!fence) return;
  if (view.state.doc.sliceString(fence.from, fence.to) === next) return;
  view.dispatch({
    changes: { from: fence.from, to: fence.to, insert: next },
    // No `selection` field: leave the outer selection where it was. The
    // widget owns its own focus (inside the nested editor) and we don't
    // want to scroll the outer viewport.
  });
}

const mermaidRenderer = {
  matches: (info: string) => info.trim().toLowerCase().startsWith("mermaid"),
  createWidget: (block: FencedCodeBlock) => {
    const body = block.source.trim();
    if (!body) return null;
    return new MermaidWidget(body, block.fenceText);
  },
};

export function mermaidDecorations() {
  return createFencedCodeRendererExtension([mermaidRenderer]);
}
