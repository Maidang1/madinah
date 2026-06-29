import { describe, expect, it } from "vitest";
import type { WriterCommand } from "../../domain/engine";
import {
  createCommandPaletteItems,
  searchCommandPaletteItems,
} from "./command-palette";

describe("command palette", () => {
  it("searches command labels, groups, and keywords with label matches first", () => {
    const commands: WriterCommand[] = [
      { id: "view.focusMode", label: "Focus Mode", group: "View", run: () => {} },
      {
        id: "document.search",
        label: "Find in Document",
        group: "Navigate",
        keywords: ["search", "current file"],
        run: () => {},
      },
      {
        id: "editor.format.bold",
        label: "Bold",
        group: "Format",
        keywords: ["strong"],
        run: () => {},
      },
    ];

    const items = createCommandPaletteItems(commands);

    expect(searchCommandPaletteItems(items, "find").map((item) => item.id)).toEqual([
      "document.search",
    ]);
    expect(searchCommandPaletteItems(items, "view").map((item) => item.id)).toEqual([
      "view.focusMode",
    ]);
    expect(searchCommandPaletteItems(items, "strong").map((item) => item.id)).toEqual([
      "editor.format.bold",
    ]);
  });

  it("keeps empty-query results grouped in command registration order", () => {
    const items = createCommandPaletteItems([
      { id: "a", label: "A", group: "File", run: () => {} },
      { id: "b", label: "B", group: "View", run: () => {} },
    ]);

    expect(searchCommandPaletteItems(items, "").map((item) => item.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
