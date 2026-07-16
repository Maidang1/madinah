import { useCallback, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, FileSlidersIcon, ViewIcon } from "@hugeicons/core-free-icons";
import { FrontmatterPanel } from "./frontmatter-panel";
import { useEscKey } from "./use-esc-key";
import { useDocumentPublish } from "@/hooks/use-document-publish";
import {
  useCloseDocumentInspector,
  useIsDocumentInspectorOpen,
  useToggleDocumentInspector,
} from "@/hooks/use-document-inspector";
import "./document-inspector.css";

const INSPECTOR_ID = "document-properties-inspector";
const INSPECTOR_TITLE_ID = "document-properties-title";

interface DocumentInspectorProps {
  filePath: string;
}

export function DocumentInspector({ filePath }: DocumentInspectorProps) {
  const isOpen = useIsDocumentInspectorOpen();
  const toggle = useToggleDocumentInspector();
  const close = useCloseDocumentInspector();
  const publication = useDocumentPublish(filePath);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const focusCloseOnMount = useCallback((node: HTMLButtonElement | null) => {
    if (!node) return;
    window.requestAnimationFrame(() => {
      if (node.isConnected) node.focus();
    });
  }, []);
  const handleClose = useCallback(() => {
    close();
    window.requestAnimationFrame(() => toggleButtonRef.current?.focus());
  }, [close]);
  useEscKey(isOpen, handleClose);

  const onlineButton =
    publication.isAvailable && publication.isPublished ? (
      <button
        type="button"
        aria-label="View online"
        title="View online"
        onClick={() => void publication.openOnline()}
        className="document-inspector-button flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
      >
        <HugeiconsIcon icon={ViewIcon} size={16} color="currentColor" strokeWidth={2} />
      </button>
    ) : null;

  const publicationStatus =
    publication.status !== "idle" ? (
      <p
        role="status"
        className={`text-[11px] leading-4 ${
          publication.status === "error"
            ? "text-[var(--text-error,#c2413b)]"
            : "text-[var(--text-muted)]"
        }`}
        title={publication.message}
      >
        {publication.message}
      </p>
    ) : null;

  return (
    <>
      <div
        aria-hidden={isOpen}
        className={`absolute right-6 top-24 z-30 flex max-w-[min(420px,calc(100%_-_48px))] flex-col items-end gap-2 transition-opacity ${
          isOpen ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
        }`}
      >
        <div className="flex items-center gap-1 rounded-lg bg-[color-mix(in_srgb,var(--reader-page)_82%,transparent)] p-1 backdrop-blur-sm">
          {!isOpen ? onlineButton : null}
          <button
            ref={toggleButtonRef}
            type="button"
            data-document-inspector-toggle
            aria-label={isOpen ? "Hide properties" : "Show properties"}
            aria-controls={INSPECTOR_ID}
            aria-expanded={isOpen}
            tabIndex={isOpen ? -1 : undefined}
            title={isOpen ? "Hide properties" : "Show properties"}
            onClick={toggle}
            className="document-inspector-button flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
          >
            <HugeiconsIcon icon={FileSlidersIcon} size={17} color="currentColor" strokeWidth={2} />
          </button>
        </div>
        {!isOpen && publicationStatus ? (
          <div className="max-w-[320px] rounded-md border border-[var(--line-subtler)] bg-[var(--surface-card)] px-3 py-2 shadow-lg">
            {publicationStatus}
          </div>
        ) : null}
      </div>

      {isOpen ? (
        <aside
          id={INSPECTOR_ID}
          data-document-inspector
          aria-labelledby={INSPECTOR_TITLE_ID}
          className="surface-card pointer-events-auto absolute right-4 top-24 z-20 flex max-h-[calc(100%_-_120px)] w-[min(360px,calc(100%_-_32px))] flex-col overflow-hidden text-[var(--text-secondary)]"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line-subtler)] px-5 py-4">
            <div className="min-w-0">
              <h2
                id={INSPECTOR_TITLE_ID}
                className="text-[13px] font-semibold leading-tight text-[var(--text-primary)]"
              >
                Properties
              </h2>
              <p className="mt-1 truncate text-[11px] leading-tight text-[var(--text-muted)]">
                Frontmatter
              </p>
            </div>
            <div className="flex items-center gap-1">
              {onlineButton}
              <button
                ref={focusCloseOnMount}
                type="button"
                aria-label="Hide properties"
                aria-controls={INSPECTOR_ID}
                aria-expanded="true"
                onClick={handleClose}
                className="document-inspector-button flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-icon-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={14} color="currentColor" strokeWidth={2} />
              </button>
            </div>
          </div>
          {publicationStatus ? (
            <div className="shrink-0 border-b border-[var(--line-subtler)] px-5 py-3">
              {publicationStatus}
            </div>
          ) : null}
          <FrontmatterPanel filePath={filePath} variant="inspector" />
        </aside>
      ) : null}
    </>
  );
}
