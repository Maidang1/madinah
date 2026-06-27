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
});
