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
        { id: "rewrite", label: "Rewrite Selection", commandId: "ai.rewriteSelection" },
        { id: "metadata", label: "Generate Metadata", commandId: "ai.generateMetadata" },
        { id: "review", label: "Review Document", commandId: "ai.reviewDocument" },
        { id: "format-separator", type: "separator" },
        { id: "bold", label: "Bold", commandId: "editor.format.bold" },
      ]),
    ).toEqual({ width: 200, height: 147 });
  });

  it("disables selection-only commands when the selection is empty", () => {
    const items = resolveEditorContextMenuItems(
      [
        {
          id: "rewrite",
          label: "Rewrite Selection",
          commandId: "ai.rewriteSelection",
          requiresSelection: true,
        },
        { id: "metadata", label: "Generate Metadata", commandId: "ai.generateMetadata" },
        { id: "review", label: "Review Document", commandId: "ai.reviewDocument" },
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
      {
        id: "rewrite",
        label: "Rewrite Selection",
        commandId: "ai.rewriteSelection",
        requiresSelection: true,
        disabled: true,
      },
      { id: "metadata", label: "Generate Metadata", commandId: "ai.generateMetadata" },
      { id: "review", label: "Review Document", commandId: "ai.reviewDocument" },
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

  it("disables commands passed by id", () => {
    const items = resolveEditorContextMenuItems(
      [
        {
          id: "rewrite",
          label: "Rewrite Selection",
          commandId: "ai.rewriteSelection",
          requiresSelection: true,
        },
        {
          id: "bold",
          label: "Bold",
          commandId: "editor.format.bold",
          requiresSelection: true,
        },
      ],
      true,
      ["ai.rewriteSelection"],
    );

    expect(items).toEqual([
      {
        id: "rewrite",
        label: "Rewrite Selection",
        commandId: "ai.rewriteSelection",
        requiresSelection: true,
        disabled: true,
      },
      {
        id: "bold",
        label: "Bold",
        commandId: "editor.format.bold",
        requiresSelection: true,
      },
    ]);
  });
});
