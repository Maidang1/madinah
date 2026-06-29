import { describe, expect, it } from "vitest";
import type { EngineProfile, PluginContext, WriterPlugin } from "../../domain/engine";
import { ExtensionHost } from "./ExtensionHost";

describe("ExtensionHost", () => {
  it("activates workspace plugins in config order", async () => {
    const host = new ExtensionHost({
      baseProfiles: [baseProfile],
      baseProfileId: "gfm",
    });

    const result = await host.activatePlugins(
      [
        pluginWithCommand("plugin.a", "alpha"),
        pluginWithCommand("plugin.b", "beta"),
      ],
      pluginContext,
    );

    expect((result.profile.commands ?? []).map((command) => command.id)).toEqual([
      "editor.insert.paragraph",
      "alpha",
      "beta",
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it("falls back to the built-in profile when a plugin throws", async () => {
    const host = new ExtensionHost({
      baseProfiles: [baseProfile],
      baseProfileId: "gfm",
    });
    const brokenPlugin: WriterPlugin = {
      id: "plugin.broken",
      name: "Broken",
      version: "1.0.0",
      activate: () => {
        throw new Error("broken activate");
      },
    };

    const result = await host.activatePlugins(
      [pluginWithCommand("plugin.a", "alpha"), brokenPlugin],
      pluginContext,
    );

    expect(result.profile.id).toBe("gfm");
    expect((result.profile.commands ?? []).map((command) => command.id)).toEqual([
      "editor.insert.paragraph",
    ]);
    expect(result.diagnostics).toEqual([
      {
        pluginId: "plugin.broken",
        severity: "error",
        message: "broken activate",
      },
    ]);
  });

  it("rejects duplicate plugin ids", async () => {
    const host = new ExtensionHost({
      baseProfiles: [baseProfile],
      baseProfileId: "gfm",
    });

    const result = await host.activatePlugins(
      [
        pluginWithCommand("plugin.same", "alpha"),
        pluginWithCommand("plugin.same", "beta"),
      ],
      pluginContext,
    );

    expect(result.profile.id).toBe("gfm");
    expect(result.diagnostics).toEqual([
      {
        pluginId: "plugin.same",
        severity: "error",
        message: "Duplicate plugin id: plugin.same",
      },
    ]);
  });
});

const baseProfile: EngineProfile = {
  id: "gfm",
  name: "GitHub Flavored Markdown",
  commands: [
    {
      id: "editor.insert.paragraph",
      label: "Text",
      run: () => undefined,
    },
  ],
};

const pluginContext: PluginContext = {
  workspace: {
    root: "/tmp/workspace",
    profile: "gfm",
    plugins: [],
  },
  commands: {
    register: () => undefined,
  },
};

function pluginWithCommand(id: string, commandId: string): WriterPlugin {
  return {
    id,
    name: id,
    version: "1.0.0",
    activate: () => ({
      commands: [
        {
          id: commandId,
          label: commandId,
          run: () => undefined,
        },
      ],
    }),
  };
}
