import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, FileSlidersIcon } from "@hugeicons/core-free-icons";
import { FrontmatterPanel } from "./frontmatter-panel";
import { useEscKey } from "./use-esc-key";
import {
  useCloseDocumentInspector,
  useIsDocumentInspectorOpen,
  useToggleDocumentInspector,
} from "@/hooks/use-document-inspector";

interface DocumentInspectorProps {
  filePath: string;
}

export function DocumentInspector({ filePath }: DocumentInspectorProps) {
  const isOpen = useIsDocumentInspectorOpen();
  const toggle = useToggleDocumentInspector();
  const close = useCloseDocumentInspector();
  useEscKey(isOpen, close);

  return (
    <>
      {!isOpen ? (
        <button
          type="button"
          data-document-inspector-toggle
          aria-label="Show properties"
          title="Show properties"
          onClick={toggle}
          className="pointer-events-auto absolute right-6 top-24 z-30 flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]"
        >
          <HugeiconsIcon icon={FileSlidersIcon} size={17} color="currentColor" strokeWidth={2} />
        </button>
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
              <div className="flex items-center justify-between gap-3 px-5 pb-5">
                <div className="min-w-0">
                  <h2 className="text-[13px] font-medium leading-tight text-[var(--text-primary)]">
                    Properties
                  </h2>
                  <p className="mt-1 truncate text-[11px] leading-tight text-[var(--text-muted)]">
                    Frontmatter
                  </p>
                </div>
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
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
                <FrontmatterPanel filePath={filePath} variant="inspector" />
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
