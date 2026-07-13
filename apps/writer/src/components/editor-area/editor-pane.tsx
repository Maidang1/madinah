import { TiptapEditor } from "./tiptap-editor";
import { DocumentPreview } from "./document-preview";
import { EditorSplitView } from "./editor-split-view";
import { AiOperationBanner } from "./ai-operation-banner";
import { AiReviewPanel } from "./ai-review-panel";
import { DocumentInspector } from "./document-inspector";
import { useCloseEditorSearchWhenInactive } from "./use-close-editor-search-when-inactive";
import { useEditorSettingsRef } from "./use-editor-settings";
import { useIsFileLoading } from "@/hooks/use-tabs";
import { memo, useEffect, useRef, useState } from "react";

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
  const writeScrollRef = useRef<HTMLDivElement | null>(null);
  useCloseEditorSearchWhenInactive(isActive);

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
      <EditorSplitView
        writePane={
          <div ref={editorSettingsRef} className="min-h-full">
            <TiptapEditor
              filePath={path}
              autoFocus={isActive}
              scrollContainerRef={writeScrollRef}
            />
          </div>
        }
        previewPane={<DocumentPreview filePath={path} />}
        writeScrollRef={writeScrollRef}
      />
      {isActive && <DocumentInspector filePath={path} />}
      {isActive && <AiOperationBanner />}
      {isActive && <AiReviewPanel filePath={path} />}
    </div>
  );
});
