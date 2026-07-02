import type {
  ResolvedPlugin,
  TrustedPluginBundle,
  TrustedPluginBundleInput,
  WriterPlugin,
} from "../../domain/engine";

export type ReadTrustedPluginBundle = (
  input: TrustedPluginBundleInput,
) => Promise<TrustedPluginBundle>;

export async function importResolvedPlugin(
  plugin: ResolvedPlugin,
  readBundle: ReadTrustedPluginBundle,
): Promise<WriterPlugin> {
  const bundle = await readBundle({
    workspaceRoot: plugin.workspaceRoot,
    packageId: plugin.packageId,
    version: plugin.version,
    entryPath: plugin.entryPath,
    bundleHash: plugin.bundleHash,
  });

  if (bundle.hash !== plugin.bundleHash) {
    throw new Error(`Plugin bundle hash changed: ${plugin.packageId}`);
  }

  const url = URL.createObjectURL(
    new Blob([bundle.code], { type: "text/javascript" }),
  );

  try {
    const mod = await importPluginModule(url);
    const loaded = mod.default ?? mod.plugin;
    if (!loaded) {
      throw new Error(`Plugin ${plugin.packageId} has no default export`);
    }
    return loaded as WriterPlugin;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function importPluginModule(url: string): Promise<Record<string, unknown>> {
  return import(/* webpackIgnore: true */ url) as Promise<Record<string, unknown>>;
}
