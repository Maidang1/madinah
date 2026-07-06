import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as tauri from "@/lib/tauri";
import type { AssetUploadSettings } from "@/lib/tauri";

const DEFAULT_ASSET_UPLOAD_SETTINGS: AssetUploadSettings = {
  schemaVersion: 2,
  provider: "cloudflare-r2-worker",
  endpoint: "",
  apiKey: "",
  publicBaseUrl: "https://assets.felixwliu.cn",
  prefix: "images/writer",
  maxBytes: 25 * 1024 * 1024,
};

function maxBytesToMb(value: number): number {
  return Math.max(1, Math.round(value / 1024 / 1024));
}

function mbToMaxBytes(value: string): number {
  const mb = Number(value);
  if (!Number.isFinite(mb)) return DEFAULT_ASSET_UPLOAD_SETTINGS.maxBytes;
  return Math.max(1, Math.round(mb)) * 1024 * 1024;
}

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

export function AssetUploadSection({ isActive }: { isActive: boolean }) {
  const [draft, setDraft] = useState<AssetUploadSettings>(DEFAULT_ASSET_UPLOAD_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!isActive || isLoaded) return;
    let cancelled = false;

    tauri
      .loadAssetUploadSettings()
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

  function updateDraft(patch: Partial<AssetUploadSettings>) {
    setDraft((current) => ({ ...current, ...patch }));
    setStatus(null);
  }

  async function save() {
    setIsBusy(true);
    setStatus(null);
    try {
      const saved = await tauri.saveAssetUploadSettings(draft);
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
      const result = await tauri.checkAssetUploadSettings(draft);
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
        <h2 className="text-[13px] font-medium text-[var(--text-muted)]">Asset Upload</h2>
        {status && (
          <span className="truncate text-[12px] text-[var(--text-muted)]" title={status}>
            {status}
          </span>
        )}
      </div>
      <div className="-mx-4 overflow-hidden rounded-2xl border border-[var(--line-subtler)] bg-[var(--surface-card)]">
        <Field label="Provider">
          <select
            value={draft.provider}
            onChange={(event) =>
              updateDraft({
                provider: event.currentTarget.value as AssetUploadSettings["provider"],
              })
            }
            className="min-w-[180px] h-9 appearance-none rounded-lg border border-transparent bg-[var(--surface-input)] bg-[length:12px_12px] bg-[position:right_10px_center] bg-no-repeat pl-3 pr-8 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none bg-[image:var(--select-chevron)]"
          >
            <option value="cloudflare-r2-worker">Cloudflare R2 Worker</option>
          </select>
        </Field>
        <div className="border-t border-[var(--line-subtler)]">
          <Field label="Endpoint">
            <input
              value={draft.endpoint}
              onChange={(event) => updateDraft({ endpoint: event.currentTarget.value })}
              placeholder="https://writer-assets.example.workers.dev"
              spellCheck={false}
              className="h-9 w-80 rounded-lg border border-transparent bg-[var(--surface-input)] px-3 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none"
            />
          </Field>
        </div>
        <div className="border-t border-[var(--line-subtler)]">
          <Field label="API Key">
            <input
              type="password"
              value={draft.apiKey}
              onChange={(event) => updateDraft({ apiKey: event.currentTarget.value })}
              spellCheck={false}
              className="h-9 w-80 rounded-lg border border-transparent bg-[var(--surface-input)] px-3 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none"
            />
          </Field>
        </div>
        <div className="border-t border-[var(--line-subtler)]">
          <Field label="Public Base URL">
            <input
              value={draft.publicBaseUrl}
              onChange={(event) => updateDraft({ publicBaseUrl: event.currentTarget.value })}
              spellCheck={false}
              className="h-9 w-80 rounded-lg border border-transparent bg-[var(--surface-input)] px-3 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none"
            />
          </Field>
        </div>
        <div className="border-t border-[var(--line-subtler)]">
          <Field label="Prefix">
            <input
              value={draft.prefix}
              onChange={(event) => updateDraft({ prefix: event.currentTarget.value })}
              spellCheck={false}
              className="h-9 w-80 rounded-lg border border-transparent bg-[var(--surface-input)] px-3 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none"
            />
          </Field>
        </div>
        <div className="border-t border-[var(--line-subtler)]">
          <Field label="Max Size">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={maxBytesToMb(draft.maxBytes)}
                onChange={(event) =>
                  updateDraft({ maxBytes: mbToMaxBytes(event.currentTarget.value) })
                }
                className="h-9 w-24 rounded-lg border border-transparent bg-[var(--surface-input)] px-3 text-[13px] text-[var(--text-secondary)] font-[inherit] outline-none focus:border-[var(--focus-border)] focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-[13px] text-[var(--text-muted)]">MB</span>
            </div>
          </Field>
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
