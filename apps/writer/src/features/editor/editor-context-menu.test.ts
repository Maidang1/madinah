import { describe, expect, it } from "vitest";
import {
  getEditorContextMenuPosition,
  getEditorContextMenuSize,
  resolveEditorContextMenuItems,
} from "./editor-context-menu";

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

  it("uses a stable 200px menu width with separators", () => {
    expect(
      getEditorContextMenuSize([
        { id: "ai", label: "AI Polish", commandId: "ai.polish.document" },
        { id: "format-separator", type: "separator" },
        { id: "bold", label: "Bold", commandId: "editor.format.bold" },
      ]),
    ).toEqual({ width: 200, height: 83 });
  });

  it("disables selection-only commands when the selection is empty", () => {
    const items = resolveEditorContextMenuItems(
      [
        { id: "ai", label: "AI Polish", commandId: "ai.polish.document" },
        { id: "format-separator", type: "separator" },
        {
          id: "bold",
          label: "Bold",
          commandId: "editor.format.bold",
          requiresSelection: true,
        },
      ],
      false,
    );

    expect(items).toEqual([
      { id: "ai", label: "AI Polish", commandId: "ai.polish.document" },
      { id: "format-separator", type: "separator" },
      {
        id: "bold",
        label: "Bold",
        commandId: "editor.format.bold",
        requiresSelection: true,
        disabled: true,
      },
    ]);
  });
});
