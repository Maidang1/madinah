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
import { OverlayScrollbar } from "@/components/overlay-scrollbar";

interface DocumentInspectorProps {
  filePath: string;
}

export function DocumentInspector({ filePath }: DocumentInspectorProps) {
  const isOpen = useIsDocumentInspectorOpen();
  const toggle = useToggleDocumentInspector();
  const close = useCloseDocumentInspector();
  const publication = useDocumentPublish(filePath);
  useEscKey(isOpen, close);

  const onlineButton =
    publication.isAvailable && publication.isPublished ? (
      <button
        type="button"
        aria-label="View online"
        title="View online"
        onClick={() => void publication.openOnline()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
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
      {!isOpen ? (
        <div className="pointer-events-auto absolute right-6 top-24 z-30 flex max-w-[min(420px,calc(100vw-48px))] flex-col items-end gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-[color-mix(in_srgb,var(--reader-page)_82%,transparent)] p-1 backdrop-blur-sm">
            {onlineButton}
            <button
              type="button"
              data-document-inspector-toggle
              aria-label="Show properties"
              title="Show properties"
              onClick={toggle}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
            >
              <HugeiconsIcon
                icon={FileSlidersIcon}
                size={17}
                color="currentColor"
                strokeWidth={2}
              />
            </button>
          </div>
          {publicationStatus ? (
            <div className="max-w-[320px] rounded-md border border-[var(--line-subtler)] bg-[var(--surface-card)] px-3 py-2 shadow-lg">
              {publicationStatus}
            </div>
          ) : null}
        </div>
      ) : null}

      {isOpen ? (
        <>
          <button
            type="button"
            aria-label="Close properties"
            className="pointer-events-auto absolute inset-0 z-10 bg-[rgba(0,0,0,0.12)] sm:hidden"
            onClick={close}
          />
          <aside
            data-document-inspector
            aria-label="Document properties"
            className="pointer-events-auto absolute bottom-0 right-0 top-0 z-10 flex w-[min(332px,calc(100vw-32px))] flex-col border-l border-[var(--line-subtler)]"
            style={{
              background:
                "color-mix(in srgb, var(--reader-page) 88%, color-mix(in srgb, var(--bg-base) 64%, transparent))",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              color: "var(--text-secondary)",
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col pt-[calc(var(--chrome-drag-height)+12px)]">
              <div className="flex items-center justify-between gap-3 px-5 pb-3">
                <div className="min-w-0">
                  <h2 className="text-[13px] font-medium leading-tight text-[var(--text-primary)]">
                    Properties
                  </h2>
                  <p className="mt-1 truncate text-[11px] leading-tight text-[var(--text-muted)]">
                    Frontmatter
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {onlineButton}
                  <button
                    type="button"
                    aria-label="Close properties"
                    onClick={close}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-icon-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
                  >
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      size={14}
                      color="currentColor"
                      strokeWidth={2}
                    />
                  </button>
                </div>
              </div>
              {publicationStatus ? <div className="px-5 pb-3">{publicationStatus}</div> : null}
              <OverlayScrollbar className="min-h-0 flex-1 px-5 pb-6">
                <FrontmatterPanel filePath={filePath} variant="inspector" />
              </OverlayScrollbar>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
