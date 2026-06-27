import type { ComponentType } from "react";
import type { MarkdownDocument } from "./document";

export type PreviewComponentMap = Record<string, ComponentType<any>>;

export interface WorkspaceInfo {
  root: string;
  configPath?: string | null;
  profile: string;
  plugins: string[];
}

export interface CodeLanguage {
  id: string;
  label: string;
  aliases?: string[];
}

export interface SlashCommand {
  id: string;
  label: string;
  hint: string;
  markdown?: string;
  commandId?: string;
}

export interface WriterCommandContext {
  document: MarkdownDocument | null;
  editor?: unknown;
  workspace?: WorkspaceInfo | null;
}

export interface WriterCommand {
  id: string;
  label: string;
  run: (ctx: WriterCommandContext) => void | Promise<void>;
}

export interface EngineProfile {
  id: string;
  name: string;
  remarkPlugins?: unknown[];
  rehypePlugins?: unknown[];
  editorPlugins?: unknown[];
  previewComponents?: PreviewComponentMap;
  slashCommands?: SlashCommand[];
  codeLanguages?: CodeLanguage[];
  commands?: WriterCommand[];
}

export interface PluginContribution {
  profiles?: EngineProfile[];
  remarkPlugins?: unknown[];
  rehypePlugins?: unknown[];
  editorPlugins?: unknown[];
  previewComponents?: PreviewComponentMap;
  slashCommands?: SlashCommand[];
  codeLanguages?: CodeLanguage[];
  commands?: WriterCommand[];
}

export interface PluginCommandRegistrar {
  register: (command: WriterCommand) => void;
}

export interface PluginContext {
  workspace: WorkspaceInfo;
  commands: PluginCommandRegistrar;
}

export interface WriterPlugin {
  id: string;
  name: string;
  version: string;
  activate: (
    ctx: PluginContext,
  ) => PluginContribution | Promise<PluginContribution>;
}

export type PluginDiagnosticSeverity = "error" | "warning";

export interface PluginDiagnostic {
  pluginId: string;
  severity: PluginDiagnosticSeverity;
  message: string;
}

export interface ResolvedPlugin {
  id: string;
  packageId: string;
  name: string;
  version: string;
  workspaceRoot: string;
  packageRoot: string;
  entryPath: string;
  bundleHash: string;
  trusted: boolean;
  capabilities: string[];
}

export interface TrustedPluginBundleInput {
  workspaceRoot: string;
  packageId: string;
  version: string;
  entryPath: string;
  bundleHash: string;
}

export interface TrustedPluginBundle {
  code: string;
  hash: string;
}

export interface WorkspacePluginTrustInput {
  workspaceRoot: string;
  packageId: string;
  version: string;
  bundleHash: string;
  trusted: boolean;
}

export interface WorkspacePluginTrustRecord extends WorkspacePluginTrustInput {
  updatedAt: string;
}

export function mergeEngineProfiles(profiles: EngineProfile[]): EngineProfile {
  if (profiles.length === 0) {
    throw new Error("At least one engine profile is required");
  }

  const commandIds = new Set<string>();
  const merged: Required<EngineProfile> = {
    id: profiles.map((profile) => profile.id).join("+"),
    name: profiles.map((profile) => profile.name).join(" + "),
    remarkPlugins: [],
    rehypePlugins: [],
    editorPlugins: [],
    previewComponents: {},
    slashCommands: [],
    codeLanguages: [],
    commands: [],
  };

  for (const profile of profiles) {
    merged.remarkPlugins.push(...(profile.remarkPlugins ?? []));
    merged.rehypePlugins.push(...(profile.rehypePlugins ?? []));
    merged.editorPlugins.push(...(profile.editorPlugins ?? []));
    Object.assign(merged.previewComponents, profile.previewComponents ?? {});
    merged.slashCommands.push(...(profile.slashCommands ?? []));
    merged.codeLanguages.push(...(profile.codeLanguages ?? []));

    for (const command of profile.commands ?? []) {
      if (commandIds.has(command.id)) {
        throw new Error(`Duplicate command id: ${command.id}`);
      }
      commandIds.add(command.id);
      merged.commands.push(command);
    }
  }

  return merged;
}

export function profileFromPluginContribution(
  plugin: WriterPlugin,
  contribution: PluginContribution,
): EngineProfile {
  return {
    id: `plugin:${plugin.id}`,
    name: plugin.name,
    remarkPlugins: contribution.remarkPlugins,
    rehypePlugins: contribution.rehypePlugins,
    editorPlugins: contribution.editorPlugins,
    previewComponents: contribution.previewComponents,
    slashCommands: contribution.slashCommands,
    codeLanguages: contribution.codeLanguages,
    commands: contribution.commands,
  };
}
