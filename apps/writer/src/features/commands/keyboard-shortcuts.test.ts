import { describe, expect, it } from "vitest";
import { getWriterKeyboardShortcutAction } from "./keyboard-shortcuts";

describe("writer keyboard shortcuts", () => {
  it("ignores keys without the command modifier", () => {
    expect(getWriterKeyboardShortcutAction({ key: "p" })).toEqual({
      kind: "none",
    });
  });

  it("routes palette and search shortcuts to UI actions", () => {
    expect(
      getWriterKeyboardShortcutAction({ key: "p", metaKey: true }),
    ).toEqual({ kind: "quick-open" });
    expect(
      getWriterKeyboardShortcutAction({
        key: "p",
        metaKey: true,
        shiftKey: true,
      }),
    ).toEqual({ kind: "command-palette" });
    expect(
      getWriterKeyboardShortcutAction({ key: "f", metaKey: true }),
    ).toEqual({ kind: "document-search" });
    expect(
      getWriterKeyboardShortcutAction({
        key: "f",
        metaKey: true,
        shiftKey: true,
      }),
    ).toEqual({ kind: "document-replace" });
    expect(
      getWriterKeyboardShortcutAction({ key: "s", metaKey: true }),
    ).toEqual({ kind: "save" });
  });

  it("routes document and formatting shortcuts through command ids", () => {
    expect(
      getWriterKeyboardShortcutAction({ key: "n", metaKey: true }),
    ).toEqual({ kind: "command", commandId: "document.new" });
    expect(
      getWriterKeyboardShortcutAction({ key: "s", metaKey: true }),
    ).toEqual({ kind: "save" });
    expect(
      getWriterKeyboardShortcutAction({
        key: "s",
        metaKey: true,
        shiftKey: true,
      }),
    ).toEqual({ kind: "none" });
    expect(
      getWriterKeyboardShortcutAction({ key: "b", metaKey: true }),
    ).toEqual({ kind: "command", commandId: "editor.format.bold" });
    expect(
      getWriterKeyboardShortcutAction({ key: "b", ctrlKey: true }),
    ).toEqual({ kind: "command", commandId: "editor.format.bold" });
  });

  it("gives option-modified view shortcuts priority", () => {
    expect(
      getWriterKeyboardShortcutAction({
        key: "f",
        metaKey: true,
        altKey: true,
      }),
    ).toEqual({ kind: "command", commandId: "view.focusMode" });
    expect(
      getWriterKeyboardShortcutAction({
        key: "1",
        metaKey: true,
        altKey: true,
      }),
    ).toEqual({ kind: "command", commandId: "editor.format.heading1" });
  });
});
