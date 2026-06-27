import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  EngineProfile,
  PluginDiagnostic,
  WorkspaceInfo,
  WriterPlugin,
} from "../../domain/engine";
import type { MdxPreviewContent } from "../../lib/mdx-preview";
import { compileMdxPreview } from "../../lib/mdx-preview";
import { CommandRegistry } from "./CommandRegistry";
import { ExtensionHost } from "./ExtensionHost";
import { ProfileRegistry } from "./ProfileRegistry";
import { createBuiltinProfiles } from "./builtinProfiles";

interface EngineContextValue {
  profile: EngineProfile;
  commandRegistry: CommandRegistry;
  diagnostics: PluginDiagnostic[];
  workspace: WorkspaceInfo | null;
  compilePreview: (source: string) => Promise<MdxPreviewContent>;
  activateWorkspacePlugins: (
    workspace: WorkspaceInfo,
    plugins: WriterPlugin[],
  ) => Promise<void>;
}

const EngineContext = createContext<EngineContextValue | null>(null);

interface EngineProviderProps {
  children: ReactNode;
  initialProfileId?: string;
}

export function EngineProvider({
  children,
  initialProfileId = "gfm",
}: EngineProviderProps) {
  const profileRegistry = useMemo(
    () => new ProfileRegistry(createBuiltinProfiles()),
    [],
  );
  const initialProfile =
    profileRegistry.get(initialProfileId) ?? profileRegistry.list()[0];
  const [profile, setProfile] = useState<EngineProfile>(initialProfile);
  const [diagnostics, setDiagnostics] = useState<PluginDiagnostic[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);

  const commandRegistry = useMemo(
    () => new CommandRegistry(profile.commands ?? [], profile.slashCommands ?? []),
    [profile],
  );

  const compilePreview = useCallback(
    (source: string) =>
      compileMdxPreview(source, {
        profile,
      }),
    [profile],
  );

  const activateWorkspacePlugins = useCallback(
    async (nextWorkspace: WorkspaceInfo, plugins: WriterPlugin[]) => {
      const host = new ExtensionHost({
        baseProfiles: profileRegistry.list(),
        baseProfileId: nextWorkspace.profile,
      });
      const registry = new CommandRegistry();
      const result = await host.activatePlugins(plugins, {
        workspace: nextWorkspace,
        commands: {
          register: (command) => registry.register(command),
        },
      });

      setWorkspace(nextWorkspace);
      setProfile(result.profile);
      setDiagnostics(result.diagnostics);
    },
    [profileRegistry],
  );

  const value = useMemo<EngineContextValue>(
    () => ({
      profile,
      commandRegistry,
      diagnostics,
      workspace,
      compilePreview,
      activateWorkspacePlugins,
    }),
    [
      activateWorkspacePlugins,
      commandRegistry,
      compilePreview,
      diagnostics,
      profile,
      workspace,
    ],
  );

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

export function useEngine(): EngineContextValue {
  const value = useContext(EngineContext);
  if (!value) {
    throw new Error("useEngine must be used inside EngineProvider");
  }
  return value;
}
