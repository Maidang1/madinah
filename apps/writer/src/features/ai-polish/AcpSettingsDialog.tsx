import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AcpAgentRuntimeConfig, AcpAgentProvider } from "../../domain/ai-polish";
import {
  ACP_PROVIDER_LABEL,
  createDefaultAcpSettings,
  formatEnvText,
  getSelectedAcpRuntimeConfig,
  normalizeAcpSettings,
  parseEnvText,
  type AcpSettings,
} from "./settings";

export type AcpCheckState =
  | { status: "idle"; message: string }
  | { status: "checking"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

interface AcpSettingsDialogProps {
  isOpen: boolean;
  isAvailable: boolean;
  settings: AcpSettings;
  checkState: AcpCheckState;
  onClose: () => void;
  onSave: (settings: AcpSettings) => void;
  onCheck: (config: AcpAgentRuntimeConfig) => void;
}

export function AcpSettingsDialog({
  isOpen,
  isAvailable,
  settings,
  checkState,
  onClose,
  onSave,
  onCheck,
}: AcpSettingsDialogProps) {
  const [draft, setDraft] = useState<AcpSettings>(() => createDefaultAcpSettings());
  const [envText, setEnvText] = useState("");
  const [envErrors, setEnvErrors] = useState<string[]>([]);
  const activeAgent = draft.agents[draft.provider];
  const hasEnvErrors = envErrors.length > 0;
  const isChecking = checkState.status === "checking";

  useEffect(() => {
    if (!isOpen) return;
    const nextDraft = normalizeAcpSettings(settings);
    setDraft(nextDraft);
    setEnvText(formatEnvText(nextDraft.agents[nextDraft.provider].env));
    setEnvErrors([]);
  }, [isOpen, settings]);

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
    setDraft((current) => ({
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

  const changeProvider = (provider: AcpAgentProvider) => {
    setDraft((current) => ({ ...current, provider }));
    setEnvText(formatEnvText(draft.agents[provider].env));
    setEnvErrors([]);
  };

  const parseCurrentEnv = () => {
    const parsed = parseEnvText(envText);
    setEnvErrors(parsed.errors);
    return parsed;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseCurrentEnv();
    if (parsed.errors.length > 0) return;

    onSave({
      ...draft,
      agents: {
        ...draft.agents,
        [draft.provider]: {
          ...activeAgent,
          env: parsed.env,
        },
      },
    });
  };

  const runCheck = () => {
    const parsed = parseCurrentEnv();
    if (parsed.errors.length > 0) return;

    const nextSettings = {
      ...draft,
      agents: {
        ...draft.agents,
        [draft.provider]: {
          ...activeAgent,
          env: parsed.env,
        },
      },
    };
    onCheck(getSelectedAcpRuntimeConfig(nextSettings));
  };

  return (
    <div className="writer-settings-backdrop" role="presentation">
      <form
        className="writer-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="writer-ai-settings-title"
        onSubmit={submit}
      >
        <header className="writer-settings-header">
          <div>
            <h2 id="writer-ai-settings-title">AI Settings</h2>
            <p>{isAvailable ? "ACP local agent" : "Desktop app required"}</p>
          </div>
          <button type="button" className="writer-settings-close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="writer-settings-segments" role="tablist" aria-label="Agent">
          {providerOptions.map(([provider, label]) => (
            <button
              type="button"
              key={provider}
              className={provider === draft.provider ? "is-selected" : undefined}
              aria-selected={provider === draft.provider}
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

        <footer className="writer-settings-footer">
          <div className={`writer-settings-status is-${checkState.status}`}>
            {checkState.message}
          </div>
          <div className="writer-settings-actions">
            <button
              type="button"
              className="writer-settings-secondary"
              onClick={runCheck}
              disabled={!isAvailable || isChecking || hasEnvErrors}
            >
              {isChecking ? "Checking" : "Test"}
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
