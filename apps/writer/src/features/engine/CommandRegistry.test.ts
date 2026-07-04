import { describe, expect, it } from "vitest";
import { CommandRegistry } from "./CommandRegistry";

describe("CommandRegistry", () => {
  it("filters commands by explicit surface metadata", () => {
    const registry = new CommandRegistry([
      {
        id: "document.open",
        label: "Open",
        surfaces: ["palette", "menu"],
        run: () => {},
      },
      {
        id: "editor.insert.h2",
        label: "Heading 2",
        surfaces: ["palette", "slash"],
        run: () => {},
      },
      {
        id: "plugin.command",
        label: "Plugin Command",
        run: () => {},
      },
    ]);

    expect(registry.list().map((command) => command.id)).toEqual([
      "document.open",
      "editor.insert.h2",
      "plugin.command",
    ]);
    expect(registry.list("palette").map((command) => command.id)).toEqual([
      "document.open",
      "editor.insert.h2",
      "plugin.command",
    ]);
    expect(registry.list("menu").map((command) => command.id)).toEqual([
      "document.open",
    ]);
    expect(registry.list("slash").map((command) => command.id)).toEqual([
      "editor.insert.h2",
    ]);
  });
});
