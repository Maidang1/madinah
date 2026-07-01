import { describe, expect, it } from "vitest";
import { createDocumentCommands } from "./document-commands";

describe("document commands", () => {
  it("dispatches document workflow commands by command id", async () => {
    const calls: string[] = [];
    const commands = createDocumentCommands({
      newDocument: () => {
        calls.push("new");
      },
      open: async () => {
        calls.push("open");
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
      "document.new",
      "document.open",
      "document.revert",
      "document.close",
    ]);
    expect(calls).toEqual(["new", "open", "revert", "close"]);
  });
});
