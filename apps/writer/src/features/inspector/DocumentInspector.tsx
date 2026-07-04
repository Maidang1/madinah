import { Clock3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type DocumentMetadataPatch,
  type DocumentStatus,
  type MarkdownDocument,
} from "../../domain/document";
import type {
  AiDocumentReviewIssue,
  AiDocumentReviewState,
} from "../../domain/ai-polish";
import type {
  PluginDiagnostic,
  WorkspaceInfo,
} from "../../domain/engine";
import { PluginDiagnostics } from "../engine/PluginDiagnostics";
import {
  DOCUMENT_STATUSES,
  formatVersionTimestamp,
  getWritingMetricItems,
  type DocumentMetrics,
  type WritingMetricItem,
} from "../workbench/document-summary";
import type { InspectorTab } from "../workbench/workbench-state";
import type { DocumentVersion } from "../history/document-history";
import { DocumentOutline } from "../outline/DocumentOutline";
import type { TocItem } from "../../lib/toc";
import {
  getInspectorTabId,
  getInspectorTabPanelId,
  InspectorTabs,
} from "./InspectorTabs";
import { WritingStats } from "./WritingStats";

interface DocumentInspectorProps {
  document: MarkdownDocument;
  metrics: DocumentMetrics;
  versions: DocumentVersion[];
  aiReviewState: AiDocumentReviewState;
  profileName: string;
  pluginDiagnostics: PluginDiagnostic[];
  workspace: WorkspaceInfo | null;
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onMetadataChange: (patch: DocumentMetadataPatch) => void;
  onOutlineJump: (item: TocItem) => void;
  onRunAiReview: () => void;
  onSaveVersion: () => void;
  onRestoreVersion: (version: DocumentVersion) => void;
}

export function DocumentInspector({
  document,
  metrics,
  versions,
  aiReviewState,
  profileName,
  pluginDiagnostics,
  workspace,
  activeTab,
  onTabChange,
  onMetadataChange,
  onOutlineJump,
  onRunAiReview,
  onSaveVersion,
  onRestoreVersion,
}: DocumentInspectorProps) {
  const [tagsInput, setTagsInput] = useState(document.tags.join(", "));
  const writingMetricItems = useMemo(
    () => getWritingMetricItems(metrics),
    [metrics],
  );

  useEffect(() => {
    setTagsInput(document.tags.join(", "));
  }, [document.id, document.tags]);

  return (
    <aside className="writer-inspector" aria-label="Document inspector">
      <InspectorTabs activeTab={activeTab} onTabChange={onTabChange} />
      <div
        className="inspector-tab-panel"
        id={getInspectorTabPanelId(activeTab)}
        role="tabpanel"
        aria-labelledby={getInspectorTabId(activeTab)}
      >
        {activeTab === "outline" ? (
          <DocumentOutline source={document.body} onJump={onOutlineJump} />
        ) : null}
        {activeTab === "properties" ? (
          <PropertiesPanel
            document={document}
            pluginDiagnostics={pluginDiagnostics}
            tagsInput={tagsInput}
            workspace={workspace}
            onTagsInputChange={setTagsInput}
            onMetadataChange={onMetadataChange}
          />
        ) : null}
        {activeTab === "stats" ? (
          <StatsPanel
            profileName={profileName}
            writingMetricItems={writingMetricItems}
          />
        ) : null}
        {activeTab === "review" ? (
          <ReviewPanel state={aiReviewState} onRunAiReview={onRunAiReview} />
        ) : null}
        {activeTab === "history" ? (
          <HistoryPanel
            document={document}
            versions={versions}
            onSaveVersion={onSaveVersion}
            onRestoreVersion={onRestoreVersion}
          />
        ) : null}
      </div>
    </aside>
  );
}

function PropertiesPanel({
  document,
  pluginDiagnostics,
  tagsInput,
  workspace,
  onTagsInputChange,
  onMetadataChange,
}: {
  document: MarkdownDocument;
  pluginDiagnostics: PluginDiagnostic[];
  tagsInput: string;
  workspace: WorkspaceInfo | null;
  onTagsInputChange: (value: string) => void;
  onMetadataChange: (patch: DocumentMetadataPatch) => void;
}) {
  return (
    <>
      <section className="inspector-section">
        <div className="inspector-section-header">
          <span>Properties</span>
        </div>
        <label className="inspector-field">
          <span>Title</span>
          <input
            id="inspector-property-title"
            name="inspector-property-title"
            value={document.title}
            onChange={(event) =>
              onMetadataChange({ title: event.currentTarget.value })
            }
          />
        </label>
        <label className="inspector-field">
          <span>Description</span>
          <textarea
            id="inspector-property-description"
            name="inspector-property-description"
            rows={3}
            value={document.description}
            onChange={(event) =>
              onMetadataChange({ description: event.currentTarget.value })
            }
          />
        </label>
        <label className="inspector-field">
          <span>Tags</span>
          <input
            id="inspector-property-tags"
            name="inspector-property-tags"
            value={tagsInput}
            onChange={(event) => onTagsInputChange(event.currentTarget.value)}
            onBlur={() => onMetadataChange({ tags: tagsInput })}
          />
        </label>
        <div className="inspector-grid">
          <label className="inspector-field">
            <span>Status</span>
            <select
              id="inspector-property-status"
              name="inspector-property-status"
              value={document.status}
              onChange={(event) =>
                onMetadataChange({
                  status: event.currentTarget.value as DocumentStatus,
                })
              }
            >
              {DOCUMENT_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="inspector-field">
            <span>Author</span>
            <input
              id="inspector-property-author"
              name="inspector-property-author"
              value={document.author}
              onChange={(event) =>
                onMetadataChange({ author: event.currentTarget.value })
              }
            />
          </label>
        </div>
        <label className="inspector-field">
          <span>Publish date</span>
          <input
            id="inspector-property-pub-date"
            name="inspector-property-pub-date"
            value={document.pubDate}
            onChange={(event) =>
              onMetadataChange({ pubDate: event.currentTarget.value })
            }
          />
        </label>
      </section>
      <PluginDiagnostics
        workspace={workspace}
        diagnostics={pluginDiagnostics}
      />
    </>
  );
}

function StatsPanel({
  profileName,
  writingMetricItems,
}: {
  profileName: string;
  writingMetricItems: WritingMetricItem[];
}) {
  return (
    <section className="inspector-section">
      <div className="inspector-section-header">
        <span>Writing</span>
        <small>{profileName}</small>
      </div>
      <WritingStats items={writingMetricItems} />
    </section>
  );
}

function ReviewPanel({
  state,
  onRunAiReview,
}: {
  state: AiDocumentReviewState;
  onRunAiReview: () => void;
}) {
  return (
    <section className="inspector-section">
      <div className="inspector-section-header">
        <span>AI Review</span>
        <button
          type="button"
          className="inspector-inline-button"
          onClick={onRunAiReview}
          disabled={state.status === "loading"}
        >
          {state.status === "loading" ? "Running" : "Run"}
        </button>
      </div>
      {state.status === "ready" && state.review ? (
        <div className="ai-review-result">
          <p className="ai-review-summary">{state.review.summary}</p>
          {state.updatedAt ? (
            <small className="ai-review-updated">
              {formatVersionTimestamp(state.updatedAt)}
            </small>
          ) : null}
          <div className="ai-review-issues" role="list">
            {state.review.issues.length > 0 ? (
              state.review.issues.map((issue, index) => (
                <ReviewIssueItem key={`${issue.title}-${index}`} issue={issue} />
              ))
            ) : (
              <p className="inspector-empty-state">No issues found.</p>
            )}
          </div>
        </div>
      ) : (
        <p
          className={
            state.status === "error"
              ? "inspector-error-state"
              : "inspector-empty-state"
          }
        >
          {state.message}
        </p>
      )}
    </section>
  );
}

function ReviewIssueItem({ issue }: { issue: AiDocumentReviewIssue }) {
  return (
    <article
      className={`ai-review-issue is-${issue.severity}`}
      role="listitem"
    >
      <div className="ai-review-issue-header">
        <span>{issue.title}</span>
        <small>{issue.severity}</small>
      </div>
      {issue.detail ? <p>{issue.detail}</p> : null}
      {issue.suggestion ? (
        <p className="ai-review-suggestion">{issue.suggestion}</p>
      ) : null}
    </article>
  );
}

function HistoryPanel({
  document,
  versions,
  onSaveVersion,
  onRestoreVersion,
}: {
  document: MarkdownDocument;
  versions: DocumentVersion[];
  onSaveVersion: () => void;
  onRestoreVersion: (version: DocumentVersion) => void;
}) {
  return (
    <section className="inspector-section">
      <div className="inspector-section-header">
        <span>History</span>
        <button type="button" onClick={onSaveVersion}>
          Save version
        </button>
      </div>
      {versions.length > 0 ? (
        <div key={document.id} className="version-list">
          {versions.map((version) => (
            <div className="version-row" key={version.id}>
              <Clock3 size={14} aria-hidden="true" />
              <span>
                <strong>{version.title || "Untitled"}</strong>
                <small>
                  {formatVersionTimestamp(version.createdAt)} / {version.reason}
                </small>
              </span>
              <button type="button" onClick={() => onRestoreVersion(version)}>
                Restore
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="version-empty">No versions saved</div>
      )}
    </section>
  );
}
