import type { EditorView } from "@codemirror/view";
import { ProseMarkEditor } from "./prosemark-editor";
import { EditorScrollContainer } from "./editor-scroll-container";
import { EditorSearchOverview } from "./editor-search-overview";
import { SectionRail } from "./section-rail";
import { AiOperationBanner } from "./ai-operation-banner";
import { AiReviewPanel } from "./ai-review-panel";
import { DocumentInspector } from "./document-inspector";
import { useCloseEditorSearchWhenInactive } from "./use-close-editor-search-when-inactive";
import { useEditorSettingsRef } from "./use-editor-settings";
import { useIsDocumentInspectorOpen } from "@/hooks/use-document-inspector";
import { useIsFileLoading } from "@/hooks/use-tabs";
import { memo, useCallback, useEffect, useRef, useState } from "react";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

function AsciiSpinner() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % SPINNER_FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return <span>{SPINNER_FRAMES[frame]}</span>;
}

interface EditorPaneProps {
  path: string;
  isActive: boolean;
}

export const EditorPane = memo(function EditorPane({ path, isActive }: EditorPaneProps) {
  const isLoading = useIsFileLoading(path);
  const editorSettingsRef = useEditorSettingsRef();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const isDocumentInspectorOpen = useIsDocumentInspectorOpen();
  useCloseEditorSearchWhenInactive(isActive);

  const getScrollContainer = useCallback(() => scrollContainerRef.current, []);

  if (isLoading) {
    return (
      <div
        className={
          isActive ? "relative z-10 h-full" : "absolute inset-0 invisible pointer-events-none"
        }
      >
        <div className="flex h-full items-center justify-center text-[13px] text-[var(--text-muted)]">
          <AsciiSpinner />
        </div>
      </div>
    );
  }

  return (
    <div
      data-pane
      className={
        isActive
          ? "relative z-10 h-full bg-[var(--reader-page)] text-[var(--reader-ink)]"
          : "absolute inset-0 invisible pointer-events-none"
      }
    >
      <EditorScrollContainer ref={scrollContainerRef}>
        <div ref={editorSettingsRef}>
          <ProseMarkEditor
            filePath={path}
            getScrollContainer={getScrollContainer}
            autoFocus={isActive}
            onViewChange={setEditorView}
          />
        </div>
      </EditorScrollContainer>
      {!isDocumentInspectorOpen && (
        <SectionRail filePath={path} view={editorView} scrollContainerRef={scrollContainerRef} />
      )}
      {isActive && <DocumentInspector filePath={path} />}
      {isActive && <AiOperationBanner />}
      {isActive && <AiReviewPanel filePath={path} />}
      {isActive && <EditorSearchOverview scrollContainerRef={scrollContainerRef} />}
    </div>
  );
});
