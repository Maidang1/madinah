import { describe, expect, it } from "vitest";
import {
  createFormattingCommands,
  formatMarkdownSelection,
  prefixMarkdownLines,
} from "./formatting-commands";

describe("formatting commands", () => {
  it("wraps selected markdown with inline syntax", () => {
    expect(formatMarkdownSelection("bold text", "**", "**", "text")).toBe(
      "**bold text**",
    );
    expect(formatMarkdownSelection("", "`", "`", "code")).toBe("`code`");
  });

  it("prefixes selected markdown lines for block syntax", () => {
    expect(prefixMarkdownLines("one\n\ntwo", "> ")).toBe("> one\n\n> two");
  });

  it("runs formatting commands against the editor selection API", async () => {
    let inserted = "";
    const commands = createFormattingCommands();
    const bold = commands.find((command) => command.id === "editor.format.bold");

    await bold?.run({
      document: null,
      editor: {
        getSelectionMarkdown: () => "selected",
        replaceSelection: (markdown: string) => {
          inserted = markdown;
        },
      },
    });

    expect(inserted).toBe("**selected**");
  });
});
