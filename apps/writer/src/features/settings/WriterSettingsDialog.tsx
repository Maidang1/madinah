import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FileCode2 } from "lucide-react";
import type {
  AcpAgentProvider,
  AcpAgentRuntimeConfig,
} from "../../domain/ai-polish";
import type { AssetUploadSettings } from "../../domain/assets";
import { normalizeAssetUploadSettings } from "../../domain/assets";
import type {
  PluginDiagnostic,
  ResolvedPlugin,
  WorkspaceInfo,
} from "../../domain/engine";
import {
  ACP_PROVIDER_LABEL,
  createDefaultAcpSettings,
  formatEnvText,
  getSelectedAcpRuntimeConfig,
  normalizeAcpSettings,
  parseEnvText,
  type AcpSettings,
} from "../ai-polish/settings";

export type SettingsCheckState =
  | { status: "idle"; message: string }
  | { status: "checking"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type SettingsTab = "editor" | "ai" | "assets" | "plugins";

interface WriterProfileOption {
  id: string;
  name: string;
  remarkPlugins?: readonly unknown[];
  rehypePlugins?: readonly unknown[];
  editorExtensions?: readonly unknown[];
  codeLanguages?: readonly unknown[];
  commands?: readonly unknown[];
}

interface WriterSettingsDialogProps {
  isOpen: boolean;
  aiAvailable: boolean;
  assetUploadAvailable: boolean;
  workspacePluginsAvailable: boolean;
  profiles: WriterProfileOption[];
  profileId: string;
  workspace: WorkspaceInfo | null;
  workspacePlugins: ResolvedPlugin[];
  pluginDiagnostics: PluginDiagnostic[];
  acpSettings: AcpSettings;
  assetSettings: AssetUploadSettings;
  acpCheckState: SettingsCheckState;
  assetCheckState: SettingsCheckState;
  workspacePluginCheckState: SettingsCheckState;
  onClose: () => void;
  onSaveProfile: (profileId: string) => void;
  onSaveAcp: (settings: AcpSettings) => void;
  onCheckAcp: (config: AcpAgentRuntimeConfig) => void;
  onSaveAssets: (settings: AssetUploadSettings) => void;
  onCheckAssets: (settings: AssetUploadSettings) => void;
  onRefreshWorkspacePlugins: () => void;
  onSetWorkspacePluginTrust: (plugin: ResolvedPlugin, trusted: boolean) => void;
}

export function WriterSettingsDialog({
  isOpen,
  aiAvailable,
  assetUploadAvailable,
  workspacePluginsAvailable,
  profiles,
  profileId,
  workspace,
  workspacePlugins,
  pluginDiagnostics,
  acpSettings,
  assetSettings,
  acpCheckState,
  assetCheckState,
  workspacePluginCheckState,
  onClose,
  onSaveProfile,
  onSaveAcp,
  onCheckAcp,
  onSaveAssets,
  onCheckAssets,
  onRefreshWorkspacePlugins,
  onSetWorkspacePluginTrust,
}: WriterSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("editor");
  const [profileDraft, setProfileDraft] = useState(profileId);
  const [acpDraft, setAcpDraft] = useState<AcpSettings>(() =>
    createDefaultAcpSettings(),
  );
  const [assetDraft, setAssetDraft] = useState<AssetUploadSettings>(() =>
    normalizeAssetUploadSettings(assetSettings),
  );
  const [envText, setEnvText] = useState("");
  const [envErrors, setEnvErrors] = useState<string[]>([]);
  const activeAgent = acpDraft.agents[acpDraft.provider];
  const hasEnvErrors = envErrors.length > 0;
  const isChecking =
    acpCheckState.status === "checking" || assetCheckState.status === "checking";

  useEffect(() => {
    if (!isOpen) return;
    const nextAcpDraft = normalizeAcpSettings(acpSettings);
    setProfileDraft(profileId);
    setAcpDraft(nextAcpDraft);
    setAssetDraft(normalizeAssetUploadSettings(assetSettings));
    setEnvText(formatEnvText(nextAcpDraft.agents[nextAcpDraft.provider].env));
    setEnvErrors([]);
  }, [acpSettings, assetSettings, isOpen, profileId]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const providerOptions = useMemo(
    () => Object.entries(ACP_PROVIDER_LABEL) as Array<[AcpAgentProvider, string]>,
    [],
  );

  if (!isOpen) return null;

  const updateAgent = (patch: Partial<typeof activeAgent>) => {
    setAcpDraft((current) => ({
      ...current,
      agents: {
        ...current.agents,
        [current.provider]: {
          ...current.agents[current.provider],
          ...patch,
        },
      },
    }));
  };

  const updateAssetDraft = (patch: Partial<AssetUploadSettings>) => {
    setAssetDraft((current) => ({ ...current, ...patch }));
  };

  const changeProvider = (provider: AcpAgentProvider) => {
    setAcpDraft((current) => ({ ...current, provider }));
    setEnvText(formatEnvText(acpDraft.agents[provider].env));
    setEnvErrors([]);
  };

  const parseCurrentEnv = () => {
    const parsed = parseEnvText(envText);
    setEnvErrors(parsed.errors);
    return parsed;
  };

  const currentAcpSettings = () => {
    const parsed = parseCurrentEnv();
    if (parsed.errors.length > 0) return null;

    return {
      ...acpDraft,
      agents: {
        ...acpDraft.agents,
        [acpDraft.provider]: {
          ...activeAgent,
          env: parsed.env,
        },
      },
    };
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (activeTab === "editor") {
      onSaveProfile(profileDraft);
      return;
    }

    if (activeTab === "assets") {
      onSaveAssets(normalizeAssetUploadSettings(assetDraft));
      return;
    }

    const nextSettings = currentAcpSettings();
    if (nextSettings) {
      onSaveAcp(nextSettings);
    }
  };

  const runCheck = () => {
    if (activeTab === "editor") return;

    if (activeTab === "assets") {
      onCheckAssets(normalizeAssetUploadSettings(assetDraft));
      return;
    }

    const nextSettings = currentAcpSettings();
    if (nextSettings) {
      onCheckAcp(getSelectedAcpRuntimeConfig(nextSettings));
    }
  };

  const checkState =
    activeTab === "assets"
      ? assetCheckState
      : activeTab === "plugins"
        ? workspacePluginCheckState
      : activeTab === "ai"
        ? acpCheckState
        : { status: "idle" as const, message: "Editor preferences" };
  const canCheck = activeTab === "assets" ? assetUploadAvailable : aiAvailable;
  const showCheckButton = activeTab === "assets" || activeTab === "ai";
  const showSaveButton = activeTab !== "plugins";
  const hasBlockingErrors = activeTab === "ai" && hasEnvErrors;
  const settingsSubtitle =
    activeTab === "assets"
      ? "Upload service assets"
      : activeTab === "plugins"
        ? "Workspace extensions"
      : activeTab === "ai"
        ? "ACP local agent"
        : "Markdown editing";
  const settingsTitle =
    activeTab === "assets"
      ? "Assets"
      : activeTab === "plugins"
        ? "Plugins"
        : activeTab === "ai"
          ? "AI"
          : "Editor";

  return (
    <div className="writer-settings-backdrop" role="presentation">
      <form
        className="writer-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="writer-settings-title"
        onSubmit={submit}
      >
        <aside className="writer-settings-sidebar" aria-label="Settings sections">
          <div className="writer-settings-sidebar-title">
            <strong>Settings</strong>
            <span>Writer</span>
          </div>
          <nav className="writer-settings-nav" aria-label="Settings sections">
            <button
              type="button"
              className={activeTab === "editor" ? "is-selected" : undefined}
              aria-current={activeTab === "editor" ? "page" : undefined}
              onClick={() => setActiveTab("editor")}
            >
              Editor
            </button>
            <button
              type="button"
              className={activeTab === "ai" ? "is-selected" : undefined}
              aria-current={activeTab === "ai" ? "page" : undefined}
              onClick={() => setActiveTab("ai")}
            >
              AI
            </button>
            <button
              type="button"
              className={activeTab === "assets" ? "is-selected" : undefined}
              aria-current={activeTab === "assets" ? "page" : undefined}
              onClick={() => setActiveTab("assets")}
            >
              Assets
            </button>
            <button
              type="button"
              className={activeTab === "plugins" ? "is-selected" : undefined}
              aria-current={activeTab === "plugins" ? "page" : undefined}
              onClick={() => setActiveTab("plugins")}
            >
              Plugins
            </button>
          </nav>
        </aside>

        <section className="writer-settings-main">
          <header className="writer-settings-header">
            <div>
              <h2 id="writer-settings-title">{settingsTitle}</h2>
              <p>{settingsSubtitle}</p>
            </div>
            <button type="button" className="writer-settings-close" onClick={onClose}>
              Close
            </button>
          </header>

          <div className="writer-settings-content">
            {activeTab === "editor" ? (
              <>
                <div className="writer-settings-section">
                  <div className="writer-settings-section-title">
                    <FileCode2 aria-hidden="true" />
                    Markdown Profile
                  </div>
                  <p className="writer-settings-description">
                    Controls which Markdown extensions and editor features are
                    active. Choose the profile that matches how you write.
                  </p>
                  <label className="writer-settings-field">
                    <span>Active profile</span>
                    <select
                      className="writer-settings-select"
                      value={profileDraft}
                      onChange={(event) =>
                        setProfileDraft(event.currentTarget.value)
                      }
                    >
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <ProfileCapabilityCard
                  profile={
                    profiles.find((profile) => profile.id === profileDraft) ??
                    null
                  }
                />
              </>
            ) : activeTab === "plugins" ? (
              <WorkspacePluginsSettings
                available={workspacePluginsAvailable}
                diagnostics={pluginDiagnostics}
                isLoading={workspacePluginCheckState.status === "checking"}
                plugins={workspacePlugins}
                workspace={workspace}
                onRefresh={onRefreshWorkspacePlugins}
                onSetTrust={onSetWorkspacePluginTrust}
              />
            ) : activeTab === "ai" ? (
              <>
                <div className="writer-settings-segments" role="tablist" aria-label="Agent">
                  {providerOptions.map(([provider, label]) => (
                    <button
                      type="button"
                      key={provider}
                      className={provider === acpDraft.provider ? "is-selected" : undefined}
                      aria-selected={provider === acpDraft.provider}
                      onClick={() => changeProvider(provider)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="writer-settings-field">
                  <span>Command</span>
                  <input
                    value={activeAgent.command}
                    onChange={(event) => updateAgent({ command: event.target.value })}
                    spellCheck={false}
                  />
                </label>

                <label className="writer-settings-field">
                  <span>Environment</span>
                  <textarea
                    value={envText}
                    onChange={(event) => {
                      const next = event.target.value;
                      const parsed = parseEnvText(next);
                      setEnvText(next);
                      setEnvErrors(parsed.errors);
                      if (parsed.errors.length === 0) {
                        updateAgent({ env: parsed.env });
                      }
                    }}
                    spellCheck={false}
                    rows={4}
                  />
                </label>
                {hasEnvErrors ? (
                  <div className="writer-settings-error">{envErrors.join(". ")}</div>
                ) : null}

                <label className="writer-settings-field">
                  <span>Instruction</span>
                  <textarea
                    value={activeAgent.instruction}
                    onChange={(event) => updateAgent({ instruction: event.target.value })}
                    rows={5}
                  />
                </label>

                <label className="writer-settings-field is-inline">
                  <span>Timeout</span>
                  <input
                    type="number"
                    min={10}
                    max={600}
                    value={activeAgent.timeoutSeconds}
                    onChange={(event) =>
                      updateAgent({ timeoutSeconds: Number(event.target.value) })
                    }
                  />
                </label>
              </>
            ) : (
              <>
                <label className="writer-settings-field">
                  <span>Provider</span>
                  <select
                    className="writer-settings-select"
                    value={assetDraft.provider}
                    onChange={(event) =>
                      updateAssetDraft({
                        provider: event.currentTarget.value as typeof assetDraft.provider,
                      })
                    }
                  >
                    <option value="cloudflare-r2-worker">
                      Cloudflare R2 Worker
                    </option>
                  </select>
                </label>
                <label className="writer-settings-field">
                  <span>Endpoint</span>
                  <input
                    value={assetDraft.endpoint}
                    onChange={(event) =>
                      updateAssetDraft({ endpoint: event.target.value })
                    }
                    placeholder="https://writer-assets.example.workers.dev"
                    spellCheck={false}
                  />
                </label>
                <label className="writer-settings-field">
                  <span>API Key</span>
                  <input
                    type="password"
                    value={assetDraft.apiKey}
                    onChange={(event) =>
                      updateAssetDraft({ apiKey: event.target.value })
                    }
                    spellCheck={false}
                  />
                </label>
                <label className="writer-settings-field">
                  <span>Public Base URL</span>
                  <input
                    value={assetDraft.publicBaseUrl}
                    onChange={(event) =>
                      updateAssetDraft({ publicBaseUrl: event.target.value })
                    }
                    spellCheck={false}
                  />
                </label>
                <label className="writer-settings-field">
                  <span>Prefix</span>
                  <input
                    value={assetDraft.prefix}
                    onChange={(event) => updateAssetDraft({ prefix: event.target.value })}
                    spellCheck={false}
                  />
                </label>
                <label className="writer-settings-field is-inline">
                  <span>Max bytes</span>
                  <input
                    type="number"
                    min={1024}
                    value={assetDraft.maxBytes}
                    onChange={(event) =>
                      updateAssetDraft({ maxBytes: Number(event.target.value) })
                    }
                  />
                </label>
              </>
            )}
          </div>

          <footer className="writer-settings-footer">
            <div className={`writer-settings-status is-${checkState.status}`}>
              {checkState.message}
            </div>
            <div className="writer-settings-actions">
              {showCheckButton ? (
                <button
                  type="button"
                  className="writer-settings-secondary"
                  onClick={runCheck}
                  disabled={!canCheck || isChecking || hasBlockingErrors}
                >
                  {checkState.status === "checking" ? "Checking" : "Test"}
                </button>
              ) : null}
              {showSaveButton ? (
                <button
                  type="submit"
                  className="writer-settings-primary"
                  disabled={hasBlockingErrors}
                >
                  Save
                </button>
              ) : null}
            </div>
          </footer>
        </section>
      </form>
    </div>
  );
}

function ProfileCapabilityCard({
  profile,
}: {
  profile: WriterProfileOption | null;
}) {
  if (!profile) return null;

  const features: string[] = [];
  const commandCount = profile.commands?.length ?? 0;
  const languageCount = profile.codeLanguages?.length ?? 0;
  const remarkCount = profile.remarkPlugins?.length ?? 0;
  const rehypeCount = profile.rehypePlugins?.length ?? 0;

  if (commandCount > 0) {
    features.push(`${commandCount} command${commandCount === 1 ? "" : "s"}`);
  }
  if (languageCount > 0) {
    features.push(
      `${languageCount} code language${languageCount === 1 ? "" : "s"}`,
    );
  }
  if (profile.editorExtensions?.length) {
    features.push("Editor extensions");
  }
  if (remarkCount > 0 || rehypeCount > 0) {
    features.push("Remark / Rehype");
  }

  return (
    <div className="writer-settings-profile-card">
      <strong>{profile.name}</strong>
      {features.length > 0 ? (
        <div className="writer-settings-profile-features">
          {features.map((feature) => (
            <span key={feature}>{feature}</span>
          ))}
        </div>
      ) : (
        <p>Standard Markdown with no additional extensions enabled.</p>
      )}
    </div>
  );
}

function WorkspacePluginsSettings({
  available,
  diagnostics,
  isLoading,
  plugins,
  workspace,
  onRefresh,
  onSetTrust,
}: {
  available: boolean;
  diagnostics: PluginDiagnostic[];
  isLoading: boolean;
  plugins: ResolvedPlugin[];
  workspace: WorkspaceInfo | null;
  onRefresh: () => void;
  onSetTrust: (plugin: ResolvedPlugin, trusted: boolean) => void;
}) {
  if (!available) {
    return (
      <div className="writer-settings-note">
        Workspace plugins require the desktop app.
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="writer-settings-note">
        Open a workspace file to inspect plugins.
      </div>
    );
  }

  return (
    <div className="writer-settings-plugin-panel">
      <div className="writer-settings-plugin-toolbar">
        <div className="writer-settings-plugin-workspace" title={workspace.root}>
          {workspace.root}
        </div>
        <button
          type="button"
          className="writer-settings-secondary"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      {plugins.length === 0 ? (
        <div className="writer-settings-note">
          Workspace config has no plugins.
        </div>
      ) : (
        <ul className="writer-settings-plugin-list">
          {plugins.map((plugin) => (
            <li className="writer-settings-plugin-row" key={plugin.packageId}>
              <div className="writer-settings-plugin-main">
                <strong>{plugin.name}</strong>
                <span>
                  {plugin.packageId}@{plugin.version}
                </span>
                <small title={plugin.entryPath}>{plugin.entryPath}</small>
                <div className="writer-settings-plugin-meta">
                  <span
                    className={
                      plugin.trusted
                        ? "writer-settings-plugin-trust is-trusted"
                        : "writer-settings-plugin-trust"
                    }
                  >
                    {plugin.trusted ? "Trusted" : "Untrusted"}
                  </span>
                  {plugin.capabilities.length > 0 ? (
                    <span>{plugin.capabilities.join(", ")}</span>
                  ) : (
                    <span>No capabilities declared</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="writer-settings-secondary"
                onClick={() => onSetTrust(plugin, !plugin.trusted)}
                disabled={isLoading}
              >
                {plugin.trusted ? "Revoke Trust" : "Trust"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {diagnostics.length > 0 ? (
        <ul className="writer-settings-plugin-diagnostics">
          {diagnostics.map((diagnostic, index) => (
            <li
              key={`${diagnostic.pluginId}:${diagnostic.severity}:${index}`}
              className={`is-${diagnostic.severity}`}
            >
              <strong>{diagnostic.pluginId}</strong>
              <span>{diagnostic.severity}</span>
              <p>{diagnostic.message}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
