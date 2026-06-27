import { describe, expect, it } from "vitest";
import type { PluginResolver } from "../../platform/ports";
import type { ResolvedPlugin, WriterPlugin } from "../../domain/engine";
import { loadTrustedWorkspacePlugins } from "./workspace-loader";

describe("workspace plugin loader", () => {
  it("loads trusted plugins in resolved workspace order", async () => {
    const imported: string[] = [];
    const result = await loadTrustedWorkspacePlugins(
      "/tmp/project/note.md",
      fakeResolver([
        resolvedPlugin("plugin.a", true),
        resolvedPlugin("plugin.b", false),
        resolvedPlugin("plugin.c", true),
      ]),
      async (plugin) => {
        imported.push(plugin.id);
        return writerPlugin(plugin.id);
      },
    );

    expect(result.workspace.root).toBe("/tmp/project");
    expect(imported).toEqual(["plugin.a", "plugin.c"]);
    expect(result.plugins.map((plugin) => plugin.id)).toEqual([
      "plugin.a",
      "plugin.c",
    ]);
    expect(result.resolvedPlugins.map((plugin) => plugin.id)).toEqual([
      "plugin.a",
      "plugin.b",
      "plugin.c",
    ]);
  });

  it("records trust for an untrusted plugin before importing it", async () => {
    const trustedInputs: string[] = [];
    const resolver = fakeResolver([resolvedPlugin("plugin.a", false)]);
    resolver.setWorkspacePluginTrust = async (input) => {
      trustedInputs.push(`${input.packageId}:${input.bundleHash}:${input.trusted}`);
      return {
        ...input,
        updatedAt: "2026-06-27T00:00:00.000Z",
      };
    };

    const result = await loadTrustedWorkspacePlugins(
      "/tmp/project/note.md",
      resolver,
      async (plugin) => writerPlugin(plugin.id),
      {
        confirmTrust: async () => true,
      },
    );

    expect(trustedInputs).toEqual(["plugin.a:plugin.a-hash:true"]);
    expect(result.plugins.map((plugin) => plugin.id)).toEqual(["plugin.a"]);
  });
});

function fakeResolver(resolvedPlugins: ResolvedPlugin[]): PluginResolver {
  return {
    async resolveWorkspace() {
      return {
        root: "/tmp/project",
        profile: "gfm",
        plugins: ["plugin.a", "plugin.b", "plugin.c"],
      };
    },
    async resolveWorkspacePlugins() {
      return resolvedPlugins;
    },
    async readTrustedPluginBundle() {
      return { code: "", hash: "" };
    },
    async setWorkspacePluginTrust(input) {
      return {
        ...input,
        updatedAt: "2026-06-27T00:00:00.000Z",
      };
    },
  };
}

function resolvedPlugin(id: string, trusted: boolean): ResolvedPlugin {
  return {
    id,
    packageId: id,
    name: id,
    version: "1.0.0",
    workspaceRoot: "/tmp/project",
    packageRoot: `/tmp/project/node_modules/${id}`,
    entryPath: `/tmp/project/node_modules/${id}/dist/browser.mjs`,
    bundleHash: `${id}-hash`,
    trusted,
    capabilities: ["commands"],
  };
}

function writerPlugin(id: string): WriterPlugin {
  return {
    id,
    name: id,
    version: "1.0.0",
    activate: () => ({}),
  };
}
