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
import { CommandRegistry } from "./CommandRegistry";
import { ExtensionHost } from "./ExtensionHost";
import { ProfileRegistry } from "./ProfileRegistry";
import { createBuiltinProfiles } from "./builtinProfiles";

const PROFILE_STORAGE_KEY = "madinah-writer-profile";

interface EngineContextValue {
  profile: EngineProfile;
  profiles: EngineProfile[];
  commandRegistry: CommandRegistry;
  diagnostics: PluginDiagnostic[];
  workspace: WorkspaceInfo | null;
  compilePreview: (source: string) => Promise<MdxPreviewContent>;
  setProfileId: (profileId: string) => void;
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
  const savedProfileId = getSavedProfileId();
  const initialProfile =
    profileRegistry.get(savedProfileId ?? initialProfileId) ??
    profileRegistry.list()[0];
  const [profile, setProfile] = useState<EngineProfile>(initialProfile);
  const [diagnostics, setDiagnostics] = useState<PluginDiagnostic[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const profiles = useMemo(() => profileRegistry.list(), [profileRegistry]);

  const commandRegistry = useMemo(
    () => new CommandRegistry(profile.commands ?? []),
    [profile],
  );

  const compilePreview = useCallback(
    async (source: string) => {
      // Lazy-load the MDX compile pipeline (@mdx-js/mdx + shiki grammars +
      // remark/rehype) so it stays out of the initial bundle until the
      // preview is actually used.
      const { compileMdxPreview } = await import("../../lib/mdx-preview");
      return compileMdxPreview(source, {
        profile,
      });
    },
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

  const setProfileId = useCallback(
    (profileId: string) => {
      setProfile(profileRegistry.require(profileId));
      window.localStorage.setItem(PROFILE_STORAGE_KEY, profileId);
    },
    [profileRegistry],
  );

  const value = useMemo<EngineContextValue>(
    () => ({
      profile,
      profiles,
      commandRegistry,
      diagnostics,
      workspace,
      compilePreview,
      setProfileId,
      activateWorkspacePlugins,
    }),
    [
      activateWorkspacePlugins,
      commandRegistry,
      compilePreview,
      diagnostics,
      profile,
      profiles,
      setProfileId,
      workspace,
    ],
  );

  return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}

function getSavedProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PROFILE_STORAGE_KEY);
}

export function useEngine(): EngineContextValue {
  const value = useContext(EngineContext);
  if (!value) {
    throw new Error("useEngine must be used inside EngineProvider");
  }
  return value;
}
