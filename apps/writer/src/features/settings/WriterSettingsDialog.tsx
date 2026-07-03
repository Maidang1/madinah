import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  AcpAgentProvider,
  AcpAgentRuntimeConfig,
} from "../../domain/ai-polish";
import type { AssetUploadSettings } from "../../domain/assets";
import { normalizeAssetUploadSettings } from "../../domain/assets";
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

type SettingsTab = "editor" | "ai" | "assets";

interface WriterProfileOption {
  id: string;
  name: string;
}

interface WriterSettingsDialogProps {
  isOpen: boolean;
  aiAvailable: boolean;
  assetUploadAvailable: boolean;
  profiles: WriterProfileOption[];
  profileId: string;
  acpSettings: AcpSettings;
  assetSettings: AssetUploadSettings;
  acpCheckState: SettingsCheckState;
  assetCheckState: SettingsCheckState;
  onClose: () => void;
  onSaveProfile: (profileId: string) => void;
  onSaveAcp: (settings: AcpSettings) => void;
  onCheckAcp: (config: AcpAgentRuntimeConfig) => void;
  onSaveAssets: (settings: AssetUploadSettings) => void;
  onCheckAssets: (settings: AssetUploadSettings) => void;
}

export function WriterSettingsDialog({
  isOpen,
  aiAvailable,
  assetUploadAvailable,
  profiles,
  profileId,
  acpSettings,
  assetSettings,
  acpCheckState,
  assetCheckState,
  onClose,
  onSaveProfile,
  onSaveAcp,
  onCheckAcp,
  onSaveAssets,
  onCheckAssets,
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
      : activeTab === "ai"
        ? acpCheckState
        : { status: "idle" as const, message: "Editor preferences" };
  const canCheck = activeTab === "assets" ? assetUploadAvailable : aiAvailable;
  const showCheckButton = activeTab !== "editor";
  const hasBlockingErrors = activeTab === "ai" && hasEnvErrors;
  const settingsSubtitle =
    activeTab === "assets"
      ? "Upload service assets"
      : activeTab === "ai"
        ? "ACP local agent"
        : "Markdown editing";
  const settingsTitle =
    activeTab === "assets" ? "Assets" : activeTab === "ai" ? "AI" : "Editor";

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
              <label className="writer-settings-field">
                <span>Markdown Profile</span>
                <select
                  className="writer-settings-select"
                  value={profileDraft}
                  onChange={(event) => setProfileDraft(event.currentTarget.value)}
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </label>
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
              <button
                type="submit"
                className="writer-settings-primary"
                disabled={hasBlockingErrors}
              >
                Save
              </button>
            </div>
          </footer>
        </section>
      </form>
    </div>
  );
}
