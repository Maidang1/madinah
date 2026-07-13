import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_AI_SETTINGS, normalizeTimeoutSeconds } from "@/lib/ai";
import * as tauri from "@/lib/tauri";
import type { AiSettings } from "@/lib/tauri";

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

export function AiSettingsSection({ isActive }: { isActive: boolean }) {
  const [draft, setDraft] = useState<AiSettings>(DEFAULT_AI_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive || isLoaded) return;
    let cancelled = false;

    tauri
      .loadAiSettings()
      .then((settings) => {
        if (cancelled) return;
        setDraft(settings);
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

  function updateSettings(patch: Partial<AiSettings>) {
    setDraft((current) => ({ ...current, ...patch }));
    setStatus(null);
  }

  async function save() {
    setIsBusy(true);
    setStatus(null);
    try {
      const saved = await tauri.saveAiSettings(draft);
      setDraft(saved);
      setStatus("Saved");
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function check() {
    setIsBusy(true);
    setStatus(null);
    try {
      const result = await tauri.checkAiSettings(draft);
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
        <Field label="Runtime">
          <span className="text-[13px] text-[var(--text-secondary)]">Codex SDK</span>
        </Field>
        <div className="border-t border-[var(--line-subtler)]">
          <Field label="Codex path">
            <input
              value={draft.codexPath}
              onChange={(event) => updateSettings({ codexPath: event.currentTarget.value })}
              placeholder="Auto-detect"
              spellCheck={false}
              className="h-9 w-80 rounded-lg border border-transparent bg-[var(--surface-input)] px-3 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none"
            />
          </Field>
        </div>
        <div className="border-t border-[var(--line-subtler)]">
          <Field label="Model">
            <input
              value={draft.model}
              onChange={(event) => updateSettings({ model: event.currentTarget.value })}
              placeholder="Codex default"
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
                value={draft.timeoutSeconds}
                onChange={(event) =>
                  updateSettings({
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
              Instruction
            </span>
            <textarea
              value={draft.instruction}
              onChange={(event) => updateSettings({ instruction: event.currentTarget.value })}
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
