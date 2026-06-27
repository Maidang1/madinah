import type {
  ResolvedPlugin,
  WorkspaceInfo,
  WriterPlugin,
} from "../../domain/engine";
import type { PluginResolver } from "../../platform/ports";
import { importResolvedPlugin } from "./PluginRuntime";

export interface WorkspacePluginLoadResult {
  workspace: WorkspaceInfo;
  resolvedPlugins: ResolvedPlugin[];
  plugins: WriterPlugin[];
}

export interface WorkspacePluginLoadOptions {
  confirmTrust?: (plugin: ResolvedPlugin) => Promise<boolean>;
}

export async function loadTrustedWorkspacePlugins(
  path: string,
  resolver: PluginResolver,
  importPlugin = (plugin: ResolvedPlugin) =>
    importResolvedPlugin(plugin, resolver.readTrustedPluginBundle),
  options: WorkspacePluginLoadOptions = {},
): Promise<WorkspacePluginLoadResult> {
  const workspace = await resolver.resolveWorkspace(path);
  const resolvedPlugins = await resolver.resolveWorkspacePlugins(workspace.root);
  const plugins: WriterPlugin[] = [];

  for (const plugin of resolvedPlugins) {
    let trustedPlugin = plugin;

    if (!trustedPlugin.trusted && options.confirmTrust) {
      const shouldTrust = await options.confirmTrust(plugin);
      if (shouldTrust) {
        await resolver.setWorkspacePluginTrust({
          workspaceRoot: plugin.workspaceRoot,
          packageId: plugin.packageId,
          version: plugin.version,
          bundleHash: plugin.bundleHash,
          trusted: true,
        });
        trustedPlugin = {
          ...plugin,
          trusted: true,
        };
      }
    }

    if (trustedPlugin.trusted) {
      plugins.push(await importPlugin(trustedPlugin));
    }
  }

  return {
    workspace,
    resolvedPlugins,
    plugins,
  };
}
