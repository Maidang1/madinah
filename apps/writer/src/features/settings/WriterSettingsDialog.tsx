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

type SettingsTab = "ai" | "assets";

interface WriterSettingsDialogProps {
  isOpen: boolean;
  aiAvailable: boolean;
  assetUploadAvailable: boolean;
  acpSettings: AcpSettings;
  assetSettings: AssetUploadSettings;
  acpCheckState: SettingsCheckState;
  assetCheckState: SettingsCheckState;
  onClose: () => void;
  onSaveAcp: (settings: AcpSettings) => void;
  onCheckAcp: (config: AcpAgentRuntimeConfig) => void;
  onSaveAssets: (settings: AssetUploadSettings) => void;
  onCheckAssets: (settings: AssetUploadSettings) => void;
}

export function WriterSettingsDialog({
  isOpen,
  aiAvailable,
  assetUploadAvailable,
  acpSettings,
  assetSettings,
  acpCheckState,
  assetCheckState,
  onClose,
  onSaveAcp,
  onCheckAcp,
  onSaveAssets,
  onCheckAssets,
}: WriterSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("ai");
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
    setAcpDraft(nextAcpDraft);
    setAssetDraft(normalizeAssetUploadSettings(assetSettings));
    setEnvText(formatEnvText(nextAcpDraft.agents[nextAcpDraft.provider].env));
    setEnvErrors([]);
  }, [acpSettings, assetSettings, isOpen]);

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
    if (activeTab === "assets") {
      onCheckAssets(normalizeAssetUploadSettings(assetDraft));
      return;
    }

    const nextSettings = currentAcpSettings();
    if (nextSettings) {
      onCheckAcp(getSelectedAcpRuntimeConfig(nextSettings));
    }
  };

  const checkState = activeTab === "assets" ? assetCheckState : acpCheckState;
  const canCheck = activeTab === "assets" ? assetUploadAvailable : aiAvailable;

  return (
    <div className="writer-settings-backdrop" role="presentation">
      <form
        className="writer-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="writer-settings-title"
        onSubmit={submit}
      >
        <header className="writer-settings-header">
          <div>
            <h2 id="writer-settings-title">Settings</h2>
            <p>{activeTab === "assets" ? "Cloudflare R2 assets" : "ACP local agent"}</p>
          </div>
          <button type="button" className="writer-settings-close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="writer-settings-segments" role="tablist" aria-label="Settings">
          <button
            type="button"
            className={activeTab === "ai" ? "is-selected" : undefined}
            aria-selected={activeTab === "ai"}
            onClick={() => setActiveTab("ai")}
          >
            AI
          </button>
          <button
            type="button"
            className={activeTab === "assets" ? "is-selected" : undefined}
            aria-selected={activeTab === "assets"}
            onClick={() => setActiveTab("assets")}
          >
            Assets
          </button>
        </div>

        {activeTab === "ai" ? (
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
              <span>Account ID</span>
              <input
                value={assetDraft.accountId}
                onChange={(event) => updateAssetDraft({ accountId: event.target.value })}
                spellCheck={false}
              />
            </label>
            <label className="writer-settings-field">
              <span>Bucket</span>
              <input
                value={assetDraft.bucket}
                onChange={(event) => updateAssetDraft({ bucket: event.target.value })}
                spellCheck={false}
              />
            </label>
            <label className="writer-settings-field">
              <span>Access Key ID</span>
              <input
                value={assetDraft.accessKeyId}
                onChange={(event) =>
                  updateAssetDraft({ accessKeyId: event.target.value })
                }
                spellCheck={false}
              />
            </label>
            <label className="writer-settings-field">
              <span>Secret Access Key</span>
              <input
                type="password"
                value={assetDraft.secretAccessKey}
                onChange={(event) =>
                  updateAssetDraft({ secretAccessKey: event.target.value })
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

        <footer className="writer-settings-footer">
          <div className={`writer-settings-status is-${checkState.status}`}>
            {checkState.message}
          </div>
          <div className="writer-settings-actions">
            <button
              type="button"
              className="writer-settings-secondary"
              onClick={runCheck}
              disabled={!canCheck || isChecking || hasEnvErrors}
            >
              {checkState.status === "checking" ? "Checking" : "Test"}
            </button>
            <button type="submit" className="writer-settings-primary" disabled={hasEnvErrors}>
              Save
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
