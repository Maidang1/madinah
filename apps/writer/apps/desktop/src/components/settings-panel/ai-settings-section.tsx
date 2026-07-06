import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  DEFAULT_AI_SETTINGS,
  formatEnvText,
  normalizeTimeoutSeconds,
  parseEnvText,
} from "@/lib/ai";
import * as tauri from "@/lib/tauri";
import type { AiAgentProvider, AiAgentSettings, AiSettings } from "@/lib/tauri";

const PROVIDER_LABEL: Record<AiAgentProvider, string> = {
  codex: "Codex",
  claude: "Claude Code",
};

interface FieldProps {
  label: string;
  children: ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="flex items-center justify-between gap-4 px-4 py-3.5">
      <span className="min-w-0 flex-1 text-[13px] font-medium text-[var(--text-primary)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function mergeAgent(
  settings: AiSettings,
  provider: AiAgentProvider,
  patch: Partial<AiAgentSettings>,
): AiSettings {
  return {
    ...settings,
    agents: {
      ...settings.agents,
      [provider]: {
        ...settings.agents[provider],
        ...patch,
      },
    },
  };
}

export function AiSettingsSection({ isActive }: { isActive: boolean }) {
  const [draft, setDraft] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [envText, setEnvText] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const provider = draft.provider;
  const agent = draft.agents[provider];

  useEffect(() => {
    if (!isActive || isLoaded) return;
    let cancelled = false;

    tauri
      .loadAiSettings()
      .then((settings) => {
        if (cancelled) return;
        setDraft(settings);
        setEnvText(formatEnvText(settings.agents[settings.provider].env));
        setStatus(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [isActive, isLoaded]);

  function selectProvider(nextProvider: AiAgentProvider) {
    const parsed = parseEnvText(envText);
    const nextDraft =
      parsed.errors.length > 0 ? draft : mergeAgent(draft, provider, { env: parsed.env });
    setDraft({
      ...nextDraft,
      provider: nextProvider,
    });
    setEnvText(formatEnvText(nextDraft.agents[nextProvider].env));
    setStatus(null);
  }

  function updateAgent(patch: Partial<AiAgentSettings>) {
    setDraft((current) => mergeAgent(current, current.provider, patch));
    setStatus(null);
  }

  function settingsForSubmit(): AiSettings | null {
    const parsed = parseEnvText(envText);
    if (parsed.errors.length > 0) {
      setStatus(parsed.errors[0]);
      return null;
    }
    return mergeAgent(draft, provider, { env: parsed.env });
  }

  async function save() {
    const settings = settingsForSubmit();
    if (!settings) return;

    setIsBusy(true);
    setStatus(null);
    try {
      const saved = await tauri.saveAiSettings(settings);
      setDraft(saved);
      setEnvText(formatEnvText(saved.agents[saved.provider].env));
      setStatus("Saved");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function check() {
    const settings = settingsForSubmit();
    if (!settings) return;

    setIsBusy(true);
    setStatus(null);
    try {
      const result = await tauri.checkAiSettings(settings);
      setStatus(result.message);
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-medium text-[var(--text-muted)]">AI</h2>
        {status && (
          <span className="truncate text-[12px] text-[var(--text-muted)]" title={status}>
            {status}
          </span>
        )}
      </div>
      <div className="-mx-4 overflow-hidden rounded-2xl border border-[var(--line-subtler)] bg-[var(--surface-card)]">
        <Field label="Provider">
          <select
            value={provider}
            onChange={(event) => selectProvider(event.currentTarget.value as AiAgentProvider)}
            className="min-w-[180px] h-9 appearance-none rounded-lg border border-transparent bg-[var(--surface-input)] bg-[length:12px_12px] bg-[position:right_10px_center] bg-no-repeat pl-3 pr-8 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none bg-[image:var(--select-chevron)]"
          >
            <option value="codex">{PROVIDER_LABEL.codex}</option>
            <option value="claude">{PROVIDER_LABEL.claude}</option>
          </select>
        </Field>
        <div className="border-t border-[var(--line-subtler)]">
          <Field label="Command">
            <input
              value={agent.command}
              onChange={(event) => updateAgent({ command: event.currentTarget.value })}
              spellCheck={false}
              className="h-9 w-80 rounded-lg border border-transparent bg-[var(--surface-input)] px-3 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none"
            />
          </Field>
        </div>
        <div className="border-t border-[var(--line-subtler)]">
          <Field label="Timeout">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={10}
                max={600}
                value={agent.timeoutSeconds}
                onChange={(event) =>
                  updateAgent({
                    timeoutSeconds: normalizeTimeoutSeconds(event.currentTarget.value),
                  })
                }
                className="h-9 w-24 rounded-lg border border-transparent bg-[var(--surface-input)] px-3 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[13px] text-[var(--text-muted)]">seconds</span>
            </div>
          </Field>
        </div>
        <div className="border-t border-[var(--line-subtler)]">
          <label className="block px-4 py-3.5">
            <span className="mb-2 block text-[13px] font-medium text-[var(--text-primary)]">
              Environment
            </span>
            <textarea
              value={envText}
              onChange={(event) => {
                setEnvText(event.currentTarget.value);
                setStatus(null);
              }}
              placeholder="OPENAI_API_KEY=..."
              spellCheck={false}
              className="min-h-24 w-full resize-y rounded-lg border border-transparent bg-[var(--surface-input)] px-3 py-2 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none"
            />
          </label>
        </div>
        <div className="border-t border-[var(--line-subtler)]">
          <label className="block px-4 py-3.5">
            <span className="mb-2 block text-[13px] font-medium text-[var(--text-primary)]">
              Instruction
            </span>
            <textarea
              value={agent.instruction}
              onChange={(event) => updateAgent({ instruction: event.currentTarget.value })}
              spellCheck={false}
              className="min-h-28 w-full resize-y rounded-lg border border-transparent bg-[var(--surface-input)] px-3 py-2 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--line-subtler)] px-4 py-3.5">
          <button
            type="button"
            onClick={() => void check()}
            disabled={isBusy}
            className="h-8 rounded-lg px-3 text-[13px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle-strong)] hover:text-[var(--text-primary)] disabled:cursor-default disabled:opacity-60"
          >
            Check
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={isBusy}
            className="h-8 rounded-lg bg-[var(--accent)] px-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </div>
    </section>
  );
}
