import { TiptapEditor } from "./tiptap-editor";
import { AiOperationBanner } from "./ai-operation-banner";
import { AiReviewPanel } from "./ai-review-panel";
import { DocumentInspector } from "./document-inspector";
import { useEditorSettingsRef } from "./use-editor-settings";
import { useIsFileLoading } from "@/hooks/use-tabs";
import { memo, useEffect, useRef, useState } from "react";
import { OverlayScrollbar } from "@/components/overlay-scrollbar";
import type { OverlayScrollbarRef } from "@/components/overlay-scrollbar";

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
  const writeScrollRef = useRef<OverlayScrollbarRef | null>(null);

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
      <OverlayScrollbar ref={writeScrollRef} className="h-full">
        <div ref={editorSettingsRef} className="min-h-full">
          <TiptapEditor filePath={path} autoFocus={isActive} scrollContainerRef={writeScrollRef} />
        </div>
      </OverlayScrollbar>
      {isActive && <DocumentInspector filePath={path} />}
      {isActive && <AiOperationBanner />}
      {isActive && <AiReviewPanel filePath={path} />}
    </div>
  );
});
