import { describe, expect, it } from "vitest";
import type { EngineProfile } from "../../domain/engine";
import { ProfileRegistry } from "./ProfileRegistry";

describe("ProfileRegistry", () => {
  it("stores profiles by id and rejects duplicate profile ids", () => {
    const registry = new ProfileRegistry([
      { id: "gfm", name: "GitHub Flavored Markdown" },
    ]);

    registry.register({ id: "mdx-compatible", name: "MDX Compatible" });

    expect(registry.get("gfm")?.name).toBe("GitHub Flavored Markdown");
    expect(registry.require("mdx-compatible").name).toBe("MDX Compatible");
    expect(() =>
      registry.register({ id: "gfm", name: "Duplicate" }),
    ).toThrow("Duplicate profile id: gfm");
  });

  it("merges contribution profiles after a selected base profile", () => {
    const registry = new ProfileRegistry([
      {
        id: "gfm",
        name: "GitHub Flavored Markdown",
        codeLanguages: [{ id: "typescript", label: "TypeScript" }],
      },
    ]);
    const workspaceProfile: EngineProfile = {
      id: "plugin:diagram",
      name: "Diagram",
      codeLanguages: [{ id: "mermaid", label: "Mermaid" }],
    };

    const merged = registry.mergeProfileStack("gfm", [workspaceProfile]);

    expect(merged.id).toBe("gfm+plugin:diagram");
    expect(merged.codeLanguages?.map((language) => language.id)).toEqual([
      "typescript",
      "mermaid",
    ]);
  });
});
