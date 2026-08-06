import { useState, type FormEvent } from "react";
import type { AgentDiscovery } from "@/platform/tauri/assistant";
import {
  type AssistantConsent,
  type AssistantDiscoveryPhase,
  type TemporaryAssistantConversation,
  useAddCustomAgent,
  useAssistantAgents,
  useAssistantError,
  useAssistantPhase,
  useAssistantRegistrationError,
  useAssistantTurnBridgeReady,
  useAssistantConsent,
  useAssistantConversation,
  useGrantAssistantConsent,
  useOpenAgentSetup,
  useRefreshAssistant,
  useRemoveCustomAgent,
  useRespondAssistantPermission,
  useSelectedAssistantAgent,
  useSelectAssistantAgent,
  useSendAssistantTurn,
  isAssistantConversationActive,
} from "@/hooks/use-assistant";
import type { ValidatedCitation } from "@/lib/grounded-answer";
import { openDocumentAtCitation } from "@/lib/document-navigation";

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
  const conversation = useAssistantConversation();
  const isTurnActive = isAssistantConversationActive(conversation);

  return (
    <>
      <AssistantTurnComposer agents={agents} />
      <AssistantCatalogView
        phase={phase}
        agents={agents}
        error={error}
        registrationError={registrationError}
        onRefresh={refresh}
        onAdd={addCustom}
        onRemove={removeCustom}
        onOpenSetup={openSetup}
        isTurnActive={isTurnActive}
      />
    </>
  );
}

function AssistantTurnComposer({ agents }: { agents: AgentDiscovery[] }) {
  const consent = useAssistantConsent();
  const grantConsent = useGrantAssistantConsent();
  const selectedAgentId = useSelectedAssistantAgent();
  const selectAgent = useSelectAssistantAgent();
  const conversation = useAssistantConversation();
  const turnBridgeReady = useAssistantTurnBridgeReady();
  const send = useSendAssistantTurn();
  const respondPermission = useRespondAssistantPermission();
  return (
    <AssistantTurnView
      agents={agents}
      consent={consent}
      selectedAgentId={selectedAgentId}
      conversation={conversation}
      turnBridgeReady={turnBridgeReady}
      onGrantConsent={grantConsent}
      onSelectAgent={selectAgent}
      onSend={send}
      onRespondPermission={respondPermission}
    />
  );
}

interface AssistantTurnViewProps {
  agents: AgentDiscovery[];
  consent: AssistantConsent;
  selectedAgentId: string | null;
  conversation: TemporaryAssistantConversation | null;
  turnBridgeReady: boolean;
  onGrantConsent: () => Promise<void>;
  onSelectAgent: (id: string) => void;
  onSend: (prompt: string) => Promise<void>;
  onRespondPermission: (optionId: string | null) => Promise<void>;
}

export function AssistantTurnView({
  agents,
  consent,
  selectedAgentId,
  conversation,
  turnBridgeReady,
  onGrantConsent: grantConsent,
  onSelectAgent: selectAgent,
  onSend: send,
  onRespondPermission: respondPermission,
}: AssistantTurnViewProps) {
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const compatible = agents.filter((agent) => agent.status === "compatible");
  const isActive = isAssistantConversationActive(conversation);
  const hasConversation = conversation !== null;

  async function handleConsent() {
    setError(null);
    try {
      await grantConsent();
    } catch (consentError) {
      setError(errorMessage(consentError));
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await send(prompt);
      setPrompt("");
    } catch (sendError) {
      setError(errorMessage(sendError));
    }
  }

  if (consent !== "granted") {
    return (
      <section className="mx-3 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
        <h3 className="text-sm font-semibold text-text-primary">Enable AI Access</h3>
        <p className="mt-2 text-xs leading-5 text-text-secondary">
          The selected Agent may use cloud services. It receives unrestricted read and write access
          to this entire Workspace, including ignored files and files that are not open as
          Documents. Changes happen directly on disk; Writer does not provide rollback or an Apply
          step. Configure and authenticate the Agent outside Writer.
        </p>
        <button
          type="button"
          disabled={consent === "loading"}
          onClick={() => void handleConsent()}
          className="mt-3 rounded-md bg-text-primary px-3 py-1.5 text-xs font-medium text-[var(--bg-base)] disabled:opacity-50"
        >
          {consent === "loading" ? "Checking…" : "Enable for this Workspace"}
        </button>
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-300">{error}</p>}
      </section>
    );
  }

  return (
    <section className="mx-3 mt-3 border-b border-[var(--line-subtler)] pb-3">
      <form onSubmit={handleSend}>
        <label className="block text-xs text-text-secondary">
          Agent
          <select
            value={selectedAgentId ?? ""}
            onChange={(event) => selectAgent(event.target.value)}
            disabled={hasConversation || compatible.length === 0}
            className="mt-1 w-full rounded-md border border-[var(--line-subtle)] bg-[var(--bg-base)] px-2 py-1.5 text-sm text-text-primary"
          >
            {compatible.length === 0 && <option value="">No compatible Agent</option>}
            {compatible.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-2 block text-xs text-text-secondary">
          Message
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            disabled={hasConversation}
            rows={3}
            placeholder="Ask the Agent to update this Workspace…"
            className="mt-1 w-full resize-y rounded-md border border-[var(--line-subtle)] bg-transparent px-2 py-1.5 text-sm text-text-primary outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={hasConversation || !turnBridgeReady || !selectedAgentId || !prompt.trim()}
          className="mt-2 w-full rounded-md bg-text-primary px-3 py-1.5 text-xs font-medium text-[var(--bg-base)] disabled:opacity-50"
        >
          {isActive ? "Agent Turn active…" : hasConversation ? "Turn complete" : "Send message"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
      {conversation && (
        <div aria-live="polite" className="mt-3 rounded-lg bg-surface-hover p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-text-muted">
              {conversation.status}
            </p>
            {conversation.grounding && !conversation.grounding.validating && (
              <span
                className={
                  conversation.grounding.status === "grounded"
                    ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300"
                    : "rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200"
                }
                data-grounding={conversation.grounding.status}
              >
                {conversation.grounding.status === "grounded" ? "Grounded" : "Ungrounded"}
              </span>
            )}
            {conversation.grounding?.validating && (
              <span className="text-[10px] text-text-muted">Checking sources…</span>
            )}
          </div>
          {conversation.grounding?.status === "ungrounded" &&
            !conversation.grounding.validating &&
            conversation.status === "completed" && (
              <p
                role="status"
                className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-xs leading-5 text-amber-900 dark:text-amber-100"
              >
                Ungrounded answer: no valid Workspace Document reference was found. The reply is
                still shown, but it is not presented as a Grounded Answer.
              </p>
            )}
          {conversation.output && (
            <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-text-primary">
              {conversation.output}
            </p>
          )}
          {conversation.grounding && conversation.grounding.citations.length > 0 && (
            <GroundingCitations citations={conversation.grounding.citations} />
          )}
          {conversation.changeSummaries.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-text-secondary">Changes</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-text-muted">
                {conversation.changeSummaries.map((summary) => (
                  <li key={summary}>{summary}</li>
                ))}
              </ul>
            </div>
          )}
          {conversation.message && conversation.message !== conversation.output && (
            <p className="mt-2 text-xs text-text-muted">{conversation.message}</p>
          )}
          {conversation.permission && (
            <div className="mt-2 rounded-md border border-amber-500/30 bg-[var(--bg-base)] p-2">
              <p className="text-xs font-medium text-text-primary">External Action</p>
              <p className="mt-1 text-xs text-text-secondary">{conversation.permission.title}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {conversation.permission.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={conversation.permission?.responding}
                    onClick={() => void respondPermission(option.id).catch(setPermissionError)}
                    className="rounded-md border border-[var(--line-subtle)] px-2 py-1 text-xs text-text-secondary disabled:opacity-50"
                  >
                    {option.name}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={conversation.permission.responding}
                  onClick={() => void respondPermission(null).catch(setPermissionError)}
                  className="rounded-md px-2 py-1 text-xs text-text-muted disabled:opacity-50"
                >
                  Cancel turn action
                </button>
              </div>
            </div>
          )}
          {conversation.reconciliation?.failures.map((failure, index) => (
            <p
              key={`${failure.phase}-${failure.path ?? index}`}
              className="mt-1 text-xs text-red-600"
            >
              Reload {failure.path ?? failure.phase}: {failure.message}
            </p>
          ))}
        </div>
      )}
    </section>
  );

  function setPermissionError(permissionError: unknown) {
    setError(errorMessage(permissionError));
  }
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
  isTurnActive?: boolean;
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
  isTurnActive = false,
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
          disabled={phase === "loading" || isTurnActive}
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
            isTurnActive={isTurnActive}
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
          disabled={isSubmitting || isTurnActive}
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
  isTurnActive,
}: {
  agent: AgentDiscovery;
  onRemove: (id: string) => Promise<void> | void;
  onOpenSetup?: (url: string) => Promise<void> | void;
  isTurnActive: boolean;
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
            disabled={isTurnActive}
            onClick={() => void onOpenSetup?.(agent.setupUrl)}
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            Install Agent
          </button>
        )}
        {agent.source === "custom" && (
          <button
            type="button"
            disabled={isTurnActive}
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

function GroundingCitations({ citations }: { citations: ValidatedCitation[] }) {
  const valid = citations.filter((citation) => citation.status === "valid");
  const invalid = citations.filter((citation) => citation.status === "invalid");
  return (
    <div className="mt-2">
      {valid.length > 0 && (
        <>
          <p className="text-xs font-medium text-text-secondary">Sources</p>
          <ul className="mt-1 space-y-1">
            {valid.map((citation) => (
              <li key={`valid-${citation.absolutePath}#${citation.anchor ?? ""}`}>
                <button
                  type="button"
                  className="text-left text-xs font-medium text-[var(--accent)] hover:underline"
                  onClick={() =>
                    void openDocumentAtCitation(citation.absolutePath, citation.anchor)
                  }
                >
                  {citation.relativePath}
                  {citation.anchor ? `#${citation.anchor}` : ""}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {invalid.length > 0 && (
        <>
          <p className="mt-2 text-xs font-medium text-text-secondary">Invalid sources</p>
          <ul className="mt-1 space-y-1">
            {invalid.map((citation, index) => (
              <li
                key={`invalid-${citation.raw}-${index}`}
                className="text-xs text-text-muted"
                data-invalid-source={citation.reason}
              >
                <span className="font-mono">{citation.raw}</span>
                <span className="ml-1 text-[10px] uppercase tracking-wide text-red-600/80 dark:text-red-300/80">
                  invalid ({citation.reason})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
