import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  EDITOR_SELECTION_TOOLBAR_ACTIONS,
  EditorSelectionToolbar,
  getEditorSelectionToolbarPosition,
} from "./EditorSelectionToolbar";

describe("EditorSelectionToolbar", () => {
  it("renders formatting actions with accessible labels", () => {
    const markup = renderToStaticMarkup(
      createElement(EditorSelectionToolbar, {
        actions: EDITOR_SELECTION_TOOLBAR_ACTIONS,
        position: { x: 24, y: 48 },
        onRun: () => {},
      }),
    );

    expect(markup).toContain('role="toolbar"');
    expect(markup).toContain('aria-label="Selection formatting"');
    expect(markup).toContain('aria-label="Bold"');
    expect(markup).toContain('aria-label="Italic"');
    expect(markup).toContain('aria-label="Link"');
    expect(markup).toContain('aria-label="Inline Code"');
    expect(markup).toContain('data-command-id="editor.format.bold"');
    expect(markup).toContain('data-command-id="editor.format.inlineCode"');
  });

  it("keeps the toolbar centered near the selection", () => {
    expect(
      getEditorSelectionToolbarPosition(
        { left: 360, right: 440, top: 120, bottom: 144 },
        { width: 176, height: 36 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 312, y: 76 });
  });

  it("keeps the toolbar inside the viewport", () => {
    expect(
      getEditorSelectionToolbarPosition(
        { left: 740, right: 780, top: 18, bottom: 38 },
        { width: 176, height: 36 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 616, y: 46 });
  });
});
