import { describe, expect, it } from "vitest";
import { NATIVE_MENU_EDIT_ROLES } from "../../../electron/shared/native-menu";
import {
  NATIVE_MENU_COMMAND_IDS,
  WRITER_COMMAND_EVENT,
  getWriterCommandIdFromPayload,
} from "./native-menu";

describe("native menu command events", () => {
  it("extracts command ids from native menu event payloads", () => {
    expect(WRITER_COMMAND_EVENT).toBe("writer-command");
    expect(getWriterCommandIdFromPayload("document.save")).toBe("document.save");
    expect(getWriterCommandIdFromPayload("")).toBeNull();
    expect(getWriterCommandIdFromPayload({ commandId: "document.save" })).toBeNull();
  });

  it("documents command ids emitted by the expanded macOS menu", () => {
    expect(NATIVE_MENU_COMMAND_IDS).toEqual([
      "document.new",
      "document.open",
      "document.save",
      "document.saveAs",
      "document.revert",
      "document.close",
      "editor.format.bold",
      "editor.format.italic",
      "editor.format.link",
      "document.search",
      "view.commandPalette",
      "view.quickOpen",
      "view.toggleSidebar",
      "view.toggleInspector",
      "view.focusMode",
      "view.typewriterMode",
      "view.write",
      "view.preview",
      "view.source",
      "go.outline",
      "inspector.showOutline",
      "inspector.showProperties",
      "inspector.showStats",
      "inspector.showHistory",
    ]);
  });

  it("keeps native editing roles in the Electron menu for clipboard shortcuts", () => {
    expect(NATIVE_MENU_EDIT_ROLES).toEqual([
      "undo",
      "redo",
      "cut",
      "copy",
      "paste",
      "pasteAndMatchStyle",
      "delete",
      "selectAll",
    ]);
  });
});
