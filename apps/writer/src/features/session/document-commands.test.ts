import { describe, expect, it } from "vitest";
import { createDocumentCommands } from "./document-commands";

describe("document commands", () => {
  it("dispatches document workflow commands by command id", async () => {
    const calls: string[] = [];
    const commands = createDocumentCommands({
      open: async () => {
        calls.push("open");
      },
      save: async () => {
        calls.push("save");
      },
      saveAs: async () => {
        calls.push("saveAs");
      },
      revert: () => {
        calls.push("revert");
      },
      close: async () => {
        calls.push("close");
      },
    });

    for (const command of commands) {
      await command.run({ document: null });
    }

    expect(commands.map((command) => command.id)).toEqual([
      "document.open",
      "document.save",
      "document.saveAs",
      "document.revert",
      "document.close",
    ]);
    expect(calls).toEqual(["open", "save", "saveAs", "revert", "close"]);
  });
});
