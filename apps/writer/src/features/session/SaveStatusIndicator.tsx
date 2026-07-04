import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Cloud, Loader2 } from "lucide-react";
import type { DocumentSession } from "./document-session";

const SAVE_STATUS_SAVING_VISIBILITY_DELAY_MS = 180;

type SaveStatusKind = "saved" | "dirty" | "saving" | "error";

interface SaveStatusView {
  kind: SaveStatusKind;
  label: string;
  detail?: string;
}

/**
 * Derives a small, friendly save-status view from the raw session state and the
 * free-form `status` string produced by {@link useDocumentSession}. The raw
 * status can be an English keyword ("Saving", "Saved") or a raw error string;
 * we never surface `String(error)` directly to the user — it is folded into a
 * short label with the original text kept as an expandable detail.
 */
export function deriveSaveStatus(
  session: Pick<DocumentSession, "isDirty" | "error" | "document">,
  status: string,
): SaveStatusView | null {
  if (!session.document) return null;

  if (session.error) {
    return { kind: "error", label: "保存失败", detail: session.error };
  }

  const normalized = status.trim().toLowerCase();

  if (normalized === "saving") {
    return { kind: "saving", label: "正在保存" };
  }

  if (session.isDirty) {
    return { kind: "dirty", label: "未保存" };
  }

  // Unknown/raw status strings (often errors) when the session itself is clean:
  // treat known-good keywords as saved, otherwise show a neutral error.
  const SAVED_KEYWORDS = new Set([
    "saved",
    "ready",
    "reverted",
    "version restored",
    "published",
    "closed",
    "deleted",
    "",
  ]);

  if (SAVED_KEYWORDS.has(normalized)) {
    return { kind: "saved", label: "已保存" };
  }

  // Anything else is an unexpected raw string — most likely an error message.
  return { kind: "error", label: "出现问题", detail: status };
}

export function SaveStatusIndicator({
  session,
  status,
}: {
  session: Pick<DocumentSession, "isDirty" | "error" | "document">;
  status: string;
}) {
  const rawView = deriveSaveStatus(session, status);
  const [showSaving, setShowSaving] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // "saved" state fades to a quieter presence after a beat so it never nags.
  const [recentlySaved, setRecentlySaved] = useState(false);
  const previousKind = useRef<SaveStatusKind | null>(null);
  const view =
    rawView?.kind === "saving" && !showSaving
      ? ({ kind: "dirty", label: "未保存" } satisfies SaveStatusView)
      : rawView;

  useEffect(() => {
    if (rawView?.kind !== "saving") {
      setShowSaving(false);
      return undefined;
    }

    const timeout = window.setTimeout(
      () => setShowSaving(true),
      SAVE_STATUS_SAVING_VISIBILITY_DELAY_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [rawView?.kind]);

  useEffect(() => {
    const kind = view?.kind ?? null;
    if (kind === "saved" && previousKind.current === "saving") {
      setRecentlySaved(true);
      const timeout = window.setTimeout(() => setRecentlySaved(false), 2200);
      previousKind.current = kind;
      return () => window.clearTimeout(timeout);
    }
    previousKind.current = kind;
    return undefined;
  }, [view?.kind]);

  useEffect(() => {
    if (view?.kind !== "error") setDetailOpen(false);
  }, [view?.kind]);

  if (!view) return null;

  const isError = view.kind === "error";

  return (
    <div
      className="save-status-indicator"
      data-kind={view.kind}
      data-recent={recentlySaved ? "true" : undefined}
    >
      <button
        type="button"
        className="save-status-indicator-chip"
        onClick={isError ? () => setDetailOpen((open) => !open) : undefined}
        title={isError ? "点击查看错误详情" : view.label}
        aria-label={view.label}
        aria-expanded={isError ? detailOpen : undefined}
        {...(isError ? {} : { tabIndex: -1 })}
      >
        <SaveStatusIcon kind={view.kind} />
        <span className="save-status-indicator-label">{view.label}</span>
      </button>
      {isError && detailOpen && view.detail ? (
        <div className="save-status-indicator-detail" role="alert">
          {view.detail}
        </div>
      ) : null}
    </div>
  );
}

function SaveStatusIcon({ kind }: { kind: SaveStatusKind }) {
  if (kind === "saving") {
    return (
      <Loader2 size={13} aria-hidden="true" className="save-status-spinner" />
    );
  }
  if (kind === "error") {
    return <AlertCircle size={13} aria-hidden="true" />;
  }
  if (kind === "dirty") {
    return <Cloud size={13} aria-hidden="true" />;
  }
  return <Check size={13} aria-hidden="true" />;
}
