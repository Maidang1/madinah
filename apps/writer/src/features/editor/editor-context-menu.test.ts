import { describe, expect, it } from "vitest";
import { getEditorContextMenuPosition } from "./editor-context-menu";

describe("editor context menu helpers", () => {
  it("keeps the menu inside the viewport", () => {
    expect(
      getEditorContextMenuPosition(
        { clientX: 780, clientY: 580 },
        { width: 180, height: 42 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 612, y: 550 });
  });

  it("keeps padding near the viewport origin", () => {
    expect(
      getEditorContextMenuPosition(
        { clientX: 2, clientY: 4 },
        { width: 180, height: 42 },
        { width: 800, height: 600 },
      ),
    ).toEqual({ x: 8, y: 8 });
  });
});
