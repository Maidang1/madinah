import {
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { AiOperationState } from "../../domain/ai-polish";

interface AiOperationBannerProps {
  state: AiOperationState;
}

export function AiOperationBanner({ state }: AiOperationBannerProps) {
  if (state.status === "idle") return null;

  const Icon = getAiOperationIcon(state.status);

  return (
    <div
      className={`ai-operation-banner is-${state.status}`}
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
      aria-busy={state.status === "running"}
      data-command-id={state.commandId}
    >
      <span className="ai-operation-banner-icon" aria-hidden="true">
        <Icon size={14} strokeWidth={2.2} />
      </span>
      <span className="ai-operation-banner-copy">
        <strong>{state.label}</strong>
        {state.detail ? <small>{state.detail}</small> : null}
      </span>
    </div>
  );
}

function getAiOperationIcon(status: AiOperationState["status"]): LucideIcon {
  if (status === "success") return CheckCircle2;
  if (status === "error") return AlertTriangle;
  return Sparkles;
}
