import { describe, expect, it } from "vitest";
import { createBuiltinProfiles } from "./builtinProfiles";

describe("built-in engine profiles", () => {
  it("maps built-in slash commands to writer command ids", () => {
    const gfm = createBuiltinProfiles().find((profile) => profile.id === "gfm");

    expect(gfm?.slashCommands?.every((command) => command.commandId)).toBe(true);
    expect(gfm?.commands?.map((command) => command.id)).toContain(
      "editor.insert.callout",
    );
  });

  it("exposes the complete GFM writing-block command set", () => {
    const gfm = createBuiltinProfiles().find((profile) => profile.id === "gfm");

    expect(gfm?.slashCommands?.map((command) => command.id)).toEqual([
      "paragraph",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "bullet",
      "number",
      "checklist",
      "quote",
      "table",
      "divider",
      "frontmatter",
      "footnote",
      "code",
      "code-typescript",
      "code-tsx",
      "code-javascript",
      "code-rust",
      "code-json",
      "code-bash",
      "code-markdown",
      "code-plaintext",
      "link",
      "image",
      "callout",
      "callout-note",
      "callout-warning",
      "callout-success",
      "callout-error",
    ]);
    expect(gfm?.slashCommands?.every((command) => command.group)).toBe(true);
    expect(gfm?.slashCommands?.every((command) => command.commandId)).toBe(true);
    expect(gfm?.commands?.map((command) => command.id)).toContain(
      "editor.insert.callout-warning",
    );
  });

  it("keeps standard markdown commands free of MDX-only callouts", () => {
    const standard = createBuiltinProfiles().find(
      (profile) => profile.id === "standard-markdown",
    );

    expect(standard?.slashCommands?.map((command) => command.id)).toContain(
      "frontmatter",
    );
    expect(standard?.slashCommands?.map((command) => command.id)).not.toContain(
      "callout",
    );
    expect(standard?.commands?.map((command) => command.id)).not.toContain(
      "editor.insert.callout",
    );
  });
});
