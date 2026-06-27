import {
  mergeEngineProfiles,
  profileFromPluginContribution,
  type EngineProfile,
  type PluginContext,
  type PluginContribution,
  type PluginDiagnostic,
  type WriterCommand,
  type WriterPlugin,
} from "../../domain/engine";

export interface ExtensionHostOptions {
  baseProfiles: EngineProfile[];
  baseProfileId: string;
}

export interface ExtensionHostActivation {
  profile: EngineProfile;
  diagnostics: PluginDiagnostic[];
}

export class ExtensionHost {
  private readonly baseProfiles: EngineProfile[];
  private readonly baseProfileId: string;

  constructor(options: ExtensionHostOptions) {
    this.baseProfiles = options.baseProfiles;
    this.baseProfileId = options.baseProfileId;
  }

  async activatePlugins(
    plugins: WriterPlugin[],
    ctx: PluginContext,
  ): Promise<ExtensionHostActivation> {
    const baseProfile = this.getBaseProfile();
    const diagnostics: PluginDiagnostic[] = [];
    const pluginIds = new Set<string>();
    const profiles: EngineProfile[] = [baseProfile];

    for (const plugin of plugins) {
      if (pluginIds.has(plugin.id)) {
        diagnostics.push({
          pluginId: plugin.id,
          severity: "error",
          message: `Duplicate plugin id: ${plugin.id}`,
        });
        continue;
      }
      pluginIds.add(plugin.id);

      try {
        const registeredCommands: WriterCommand[] = [];
        const contribution = await plugin.activate({
          ...ctx,
          commands: {
            register: (command) => {
              registeredCommands.push(command);
              ctx.commands.register(command);
            },
          },
        });
        const combinedContribution = withRegisteredCommands(
          contribution,
          registeredCommands,
        );
        profiles.push(...(combinedContribution.profiles ?? []));
        profiles.push(profileFromPluginContribution(plugin, combinedContribution));
      } catch (error) {
        diagnostics.push({
          pluginId: plugin.id,
          severity: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      return {
        profile: baseProfile,
        diagnostics,
      };
    }

    try {
      return {
        profile: mergeEngineProfiles(profiles),
        diagnostics,
      };
    } catch (error) {
      return {
        profile: baseProfile,
        diagnostics: [
          ...diagnostics,
          {
            pluginId: "extension-host",
            severity: "error",
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
    }
  }

  private getBaseProfile(): EngineProfile {
    const profile = this.baseProfiles.find((item) => item.id === this.baseProfileId);
    if (profile) return profile;
    const [fallback] = this.baseProfiles;
    if (fallback) return fallback;
    throw new Error("At least one base profile is required");
  }
}

function withRegisteredCommands(
  contribution: PluginContribution,
  registeredCommands: WriterCommand[],
): PluginContribution {
  if (registeredCommands.length === 0) return contribution;

  return {
    ...contribution,
    commands: [...registeredCommands, ...(contribution.commands ?? [])],
  };
}
