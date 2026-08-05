import { useState, type FormEvent } from "react";
import type { AgentDiscovery } from "@/platform/tauri/assistant";
import {
  type AssistantDiscoveryPhase,
  useAddCustomAgent,
  useAssistantAgents,
  useAssistantError,
  useAssistantPhase,
  useAssistantRegistrationError,
  useOpenAgentSetup,
  useRefreshAssistant,
  useRemoveCustomAgent,
} from "@/hooks/use-assistant";

interface AssistantPanelProps {
  onCollapse: () => void;
}

export function AssistantPanel({ onCollapse }: AssistantPanelProps) {
  return (
    <aside
      id="assistant-panel"
      tabIndex={-1}
      aria-label="Assistant"
      className="flex h-full min-h-0 flex-col border-l border-[var(--line-subtler)] bg-[var(--bg-base)] outline-none"
    >
      <header className="flex h-12 shrink-0 items-center justify-between px-3 pt-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
            Assistant
          </p>
          <h2 className="text-sm font-semibold text-text-primary">Local ACP Agents</h2>
        </div>
        <button
          type="button"
          aria-label="Collapse Assistant"
          onClick={onCollapse}
          className="rounded-md px-2 py-1 text-xs text-text-muted hover:bg-surface-hover hover:text-text-primary"
        >
          Hide
        </button>
      </header>
      <AssistantCatalog />
    </aside>
  );
}

function AssistantCatalog() {
  const phase = useAssistantPhase();
  const agents = useAssistantAgents();
  const error = useAssistantError();
  const registrationError = useAssistantRegistrationError();
  const refresh = useRefreshAssistant();
  const addCustom = useAddCustomAgent();
  const removeCustom = useRemoveCustomAgent();
  const openSetup = useOpenAgentSetup();

  return (
    <AssistantCatalogView
      phase={phase}
      agents={agents}
      error={error}
      registrationError={registrationError}
      onRefresh={refresh}
      onAdd={addCustom}
      onRemove={removeCustom}
      onOpenSetup={openSetup}
    />
  );
}

interface AssistantCatalogViewProps {
  phase: AssistantDiscoveryPhase;
  agents: AgentDiscovery[];
  error: string | null;
  registrationError: string | null;
  onRefresh: () => Promise<void> | void;
  onAdd: (command: string, args: string[]) => Promise<void> | void;
  onRemove: (id: string) => Promise<void> | void;
  onOpenSetup?: (url: string) => Promise<void> | void;
}

export function AssistantCatalogView({
  phase,
  agents,
  error,
  registrationError,
  onRefresh,
  onAdd,
  onRemove,
  onOpenSetup,
}: AssistantCatalogViewProps) {
  const [command, setCommand] = useState("");
  const [useStdio, setUseStdio] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = command.trim();
    if (!trimmed) {
      setFormError("Enter an installed ACP executable.");
      return;
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      await onAdd(trimmed, useStdio ? ["--stdio"] : []);
      setCommand("");
      setUseStdio(false);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemove(id: string) {
    setFormError(null);
    try {
      await onRemove(id);
    } catch (removeError) {
      setFormError(removeError instanceof Error ? removeError.message : String(removeError));
    }
  }

  async function handleOpenSetup(url: string) {
    setFormError(null);
    try {
      await onOpenSetup?.(url);
    } catch (setupError) {
      setFormError(setupError instanceof Error ? setupError.message : String(setupError));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-4 pt-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-xs leading-5 text-text-muted">
          Writer checks installed native ACP Agents directly. Configure and authenticate them
          outside Writer; Writer never downloads packages or stores runtime values or credentials.
        </p>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={phase === "loading"}
          className="shrink-0 rounded-md border border-[var(--line-subtle)] px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover disabled:opacity-50"
        >
          {phase === "loading" ? "Checking…" : "Retry"}
        </button>
      </div>

      {(error || registrationError) && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-red-500/25 bg-red-500/5 p-2 text-xs text-red-700 dark:text-red-300"
        >
          {error || registrationError}
        </div>
      )}

      <div aria-live="polite" className="space-y-2">
        {phase === "loading" && agents.length === 0 && (
          <p className="py-6 text-center text-xs text-text-muted">Checking local ACP Agents…</p>
        )}
        {agents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onRemove={handleRemove}
            onOpenSetup={handleOpenSetup}
          />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 border-t border-[var(--line-subtler)] pt-4">
        <h3 className="text-sm font-medium text-text-primary">Add custom Agent</h3>
        <p className="mt-1 text-xs leading-5 text-text-muted">
          Enter the canonical absolute path of a native executable. Scripts and symlinks are
          rejected. Configure and authenticate it outside Writer. The executable must be
          self-contained: private-copy discovery cannot load sibling resources, helpers, or
          libraries through <code className="font-mono">current_exe</code>,{" "}
          <code className="font-mono">$ORIGIN</code>, or{" "}
          <code className="font-mono">@executable_path</code>.
        </p>
        <label className="mt-3 block text-xs text-text-secondary">
          Native executable path
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="/usr/local/bin/my-agent-acp"
            autoComplete="off"
            className="mt-1 w-full rounded-md border border-[var(--line-subtle)] bg-transparent px-2 py-1.5 text-sm text-text-primary outline-none focus:border-[var(--border-color)]"
          />
        </label>
        <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-text-secondary">
          <input
            type="checkbox"
            checked={useStdio}
            onChange={(event) => setUseStdio(event.target.checked)}
            className="mt-1"
          />
          Pass the safe valueless <code className="font-mono">--stdio</code> transport switch
        </label>
        {formError && <p className="mt-2 text-xs text-red-600 dark:text-red-300">{formError}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-3 w-full rounded-md bg-text-primary px-3 py-1.5 text-xs font-medium text-[var(--bg-base)] disabled:opacity-50"
        >
          {isSubmitting ? "Adding…" : "Add Agent"}
        </button>
      </form>
    </div>
  );
}

function AgentCard({
  agent,
  onRemove,
  onOpenSetup,
}: {
  agent: AgentDiscovery;
  onRemove: (id: string) => Promise<void> | void;
  onOpenSetup?: (url: string) => Promise<void> | void;
}) {
  const label = statusLabel(agent.status);
  return (
    <article className="rounded-lg border border-[var(--line-subtler)] p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-text-primary">{agent.name}</h3>
          <p className="truncate font-mono text-[10px] text-text-muted">{agent.command}</p>
        </div>
        <span className="shrink-0 rounded-full bg-surface-hover px-2 py-0.5 text-[10px] text-text-secondary">
          {label}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-text-muted">{agent.message}</p>
      {agent.missingCapabilities.length > 0 && (
        <p className="mt-1 text-[11px] text-text-secondary">
          Missing: {agent.missingCapabilities.join(", ")}
        </p>
      )}
      <div className="mt-2 flex gap-2">
        {agent.status === "missing" && agent.setupUrl && (
          <button
            type="button"
            onClick={() => void onOpenSetup?.(agent.setupUrl)}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            Install Agent
          </button>
        )}
        {agent.source === "custom" && (
          <button
            type="button"
            onClick={() => void onRemove(agent.id)}
            className="text-xs text-text-muted hover:text-red-600"
          >
            Remove
          </button>
        )}
      </div>
    </article>
  );
}

function statusLabel(status: AgentDiscovery["status"]): string {
  switch (status) {
    case "compatible":
      return "Compatible";
    case "missing":
      return "Not installed";
    case "authentication-required":
      return "Authentication required";
    case "incompatible":
      return "Incompatible";
    case "handshake-failed":
      return "Handshake failed";
  }
}
