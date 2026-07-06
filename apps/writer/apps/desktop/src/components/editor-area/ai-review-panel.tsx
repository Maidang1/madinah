import { clearAiReviewState, useAiReviewStore } from "./ai-review-store";
import type { AiDocumentReviewIssue } from "@/lib/tauri";

interface AiReviewPanelProps {
  filePath: string;
}

export function AiReviewPanel({ filePath }: AiReviewPanelProps) {
  const state = useAiReviewStore((store) => store.reviewState);
  if (state.status === "idle" || state.filePath !== filePath) return null;

  return (
    <aside
      aria-label="AI Review"
      className="pointer-events-auto absolute bottom-6 left-4 right-4 top-24 z-20 overflow-auto rounded-lg border p-4 text-[13px] shadow-xl sm:bottom-auto sm:left-auto sm:right-6 sm:max-h-[640px] sm:w-[380px]"
      style={{
        background: "color-mix(in srgb, var(--bg-base) 82%, var(--surface-card))",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderColor: "var(--line-subtler)",
        color: "var(--text-secondary)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold leading-tight text-[var(--text-primary)]">
            AI Review
          </h2>
          {state.updatedAt ? (
            <p className="mt-1 text-[11px] leading-tight text-[var(--text-muted)]">
              {formatReviewTime(state.updatedAt)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Close review"
          onClick={clearAiReviewState}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-icon-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
        >
          ×
        </button>
      </div>

      {state.status === "ready" && state.review ? (
        <div className="space-y-3">
          <p className="leading-5 text-[var(--text-primary)]">{state.review.summary}</p>
          <div className="space-y-2" role="list">
            {state.review.issues.length > 0 ? (
              state.review.issues.map((issue, index) => (
                <ReviewIssue key={`${issue.title}-${index}`} issue={issue} />
              ))
            ) : (
              <p className="text-[var(--text-muted)]">No issues found.</p>
            )}
          </div>
        </div>
      ) : (
        <p
          className={
            state.status === "error"
              ? "leading-5 text-[#d14d41]"
              : "leading-5 text-[var(--text-muted)]"
          }
        >
          {state.message}
        </p>
      )}
    </aside>
  );
}

function ReviewIssue({ issue }: { issue: AiDocumentReviewIssue }) {
  return (
    <article
      role="listitem"
      className="rounded-md border px-3 py-2"
      style={{
        borderColor: severityBorder(issue.severity),
        background: "color-mix(in srgb, var(--surface-subtle) 72%, transparent)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 text-[12px] font-semibold leading-5 text-[var(--text-primary)]">
          {issue.title}
        </h3>
        <span
          className="shrink-0 text-[10px] uppercase leading-4 tracking-normal"
          style={{ color: severityColor(issue.severity) }}
        >
          {issue.severity}
        </span>
      </div>
      {issue.detail ? <p className="mt-1 leading-5">{issue.detail}</p> : null}
      {issue.suggestion ? (
        <p className="mt-2 leading-5 text-[var(--text-muted)]">{issue.suggestion}</p>
      ) : null}
    </article>
  );
}

function formatReviewTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityColor(severity: AiDocumentReviewIssue["severity"]): string {
  if (severity === "critical") return "#d14d41";
  if (severity === "warning") return "#b7791f";
  return "var(--text-muted)";
}

function severityBorder(severity: AiDocumentReviewIssue["severity"]): string {
  if (severity === "critical") return "rgba(209, 77, 65, 0.36)";
  if (severity === "warning") return "rgba(183, 121, 31, 0.36)";
  return "var(--line-subtler)";
}
