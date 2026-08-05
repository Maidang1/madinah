import { useCallback, useState } from "react";
import { Sidebar } from "./sidebar";
import { EditorArea } from "./editor-area";
import { EditorTabs } from "./editor-area/editor-tabs";
import { AssistantPanel } from "./assistant/assistant-panel";
import { SidebarToggleButton } from "./sidebar/sidebar-toggle-button";
import { CompactFileLayout } from "./compact-file-layout";
import { useSidebar } from "@/hooks/use-sidebar";
import { useWorkspaceChromeMode } from "@/hooks/use-workspace";
import { useAssistantDiscoveryLifecycle } from "@/hooks/use-assistant";
import {
  revealOrFocusAssistant,
  useAssistantWidth,
  useCollapseAssistant,
  useIsAssistantCollapsed,
  useSetAssistantWidth,
} from "@/hooks/use-assistant-panel";
import { resolvePaneWidths } from "@/lib/pane-layout";

export function AppLayout() {
  const chromeMode = useWorkspaceChromeMode();
  if (chromeMode === "compact-file") {
    return <CompactFileLayout />;
  }

  return <WorkspaceLayout />;
}

function useContainerWidth(fallback = 1200): [number, React.RefCallback<HTMLDivElement>] {
  const [width, setWidth] = useState(fallback);
  const observe = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const measure = () => {
      const measured = Math.round(node.getBoundingClientRect().width);
      if (measured > 0) setWidth((current) => (current === measured ? current : measured));
    };
    measure();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    }

    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return [width, observe];
}

function WorkspaceLayout() {
  useAssistantDiscoveryLifecycle();
  const { isSidebarCollapsed, sidebarWidth, setSidebarWidth } = useSidebar();
  const isAssistantCollapsed = useIsAssistantCollapsed();
  const assistantWidth = useAssistantWidth();
  const setAssistantWidth = useSetAssistantWidth();
  const collapseAssistant = useCollapseAssistant();
  const [containerWidth, observeContainer] = useContainerWidth();
  const [drag, setDrag] = useState<{
    pane: "left" | "right";
    pointerId: number;
    startX: number;
    startWidth: number;
    requestedWidth: number;
  } | null>(null);
  const widths = resolvePaneWidths({
    containerWidth,
    leftVisible: !isSidebarCollapsed,
    leftWidth: drag?.pane === "left" ? drag.requestedWidth : sidebarWidth,
    rightVisible: !isAssistantCollapsed,
    rightWidth: drag?.pane === "right" ? drag.requestedWidth : assistantWidth,
    preferredPane: drag?.pane,
  });
  const isSidebarDragging = drag?.pane === "left";
  const isAssistantDragging = drag?.pane === "right";
  const tabChromeLeft = isSidebarCollapsed ? 132 : widths.left + 12;
  const tabChromeRight = isAssistantCollapsed ? 104 : widths.right + 12;

  const startResize = useCallback(
    (pane: "left" | "right", event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const startWidth = pane === "left" ? widths.left : widths.right;
      setDrag({
        pane,
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth,
        requestedWidth: startWidth,
      });
    },
    [widths.left, widths.right],
  );

  const continueResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    setDrag((current) => {
      if (!current || current.pointerId !== event.pointerId) return current;
      const delta = event.clientX - current.startX;
      return {
        ...current,
        requestedWidth: current.startWidth + (current.pane === "left" ? delta : -delta),
      };
    });
  }, []);

  const finishResize = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, persist: boolean) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (persist) {
        if (drag.pane === "left" && widths.left !== sidebarWidth) {
          void setSidebarWidth(widths.left);
        }
        if (drag.pane === "right" && widths.right !== assistantWidth) {
          void setAssistantWidth(widths.right);
        }
      }
      setDrag(null);
    },
    [
      assistantWidth,
      drag,
      setAssistantWidth,
      setSidebarWidth,
      sidebarWidth,
      widths.left,
      widths.right,
    ],
  );

  return (
    <div
      ref={observeContainer}
      className={`relative h-screen w-screen overflow-hidden text-text-primary${drag ? " cursor-col-resize select-none" : ""}`}
    >
      <div
        data-tauri-drag-region
        className="absolute inset-x-0 top-0 z-30"
        style={{ height: "var(--chrome-drag-height)" }}
      />
      <div
        className="pointer-events-auto absolute left-0 top-0 z-50 flex items-center"
        style={{
          height: "calc(var(--chrome-control-height) + var(--chrome-control-padding) * 2)",
          padding: "var(--chrome-control-padding) 12px var(--chrome-control-padding) 92px",
        }}
      >
        <SidebarToggleButton />
      </div>
      <div
        className="pointer-events-none absolute top-0 z-40"
        style={{
          left: tabChromeLeft,
          right: tabChromeRight,
          transition:
            isSidebarDragging || isAssistantDragging
              ? "none"
              : "left 140ms ease-out, right 140ms ease-out",
        }}
      >
        <div className="pointer-events-auto">
          <EditorTabs />
        </div>
      </div>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex min-h-0 flex-1">
          <div
            className="shrink-0 overflow-hidden"
            style={{
              width: isSidebarCollapsed ? 0 : widths.left,
              transition: isSidebarDragging ? "none" : "width 140ms ease-out",
            }}
          >
            <div style={{ width: widths.left }} className="h-full">
              <Sidebar />
            </div>
          </div>
          {!isSidebarCollapsed && (
            <div
              role="presentation"
              aria-hidden="true"
              data-resize-handle
              data-dragging={isSidebarDragging || undefined}
              onPointerDown={(event) => startResize("left", event)}
              onPointerMove={continueResize}
              onPointerUp={(event) => finishResize(event, true)}
              onPointerCancel={(event) => finishResize(event, false)}
              className="relative w-0 shrink-0 cursor-col-resize before:absolute before:inset-y-0 before:-left-1 before:w-2 before:content-[''] after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-transparent after:transition-colors after:content-[''] hover:after:bg-[var(--line-subtle)] data-[dragging]:after:bg-[var(--border-color)]"
            />
          )}

          <div className="relative min-w-0 flex-1 overflow-hidden shadow-[var(--chrome-shadow)]">
            <EditorArea />
          </div>

          {!isAssistantCollapsed && (
            <div
              role="presentation"
              aria-hidden="true"
              data-resize-handle
              data-dragging={isAssistantDragging || undefined}
              onPointerDown={(event) => startResize("right", event)}
              onPointerMove={continueResize}
              onPointerUp={(event) => finishResize(event, true)}
              onPointerCancel={(event) => finishResize(event, false)}
              className="relative w-0 shrink-0 cursor-col-resize before:absolute before:inset-y-0 before:-left-1 before:w-2 before:content-[''] after:pointer-events-none after:absolute after:inset-y-0 after:left-0 after:w-px after:bg-transparent after:transition-colors after:content-[''] hover:after:bg-[var(--line-subtle)] data-[dragging]:after:bg-[var(--border-color)]"
            />
          )}
          <div
            className="shrink-0 overflow-hidden"
            style={{
              width: isAssistantCollapsed ? 0 : widths.right,
              transition: isAssistantDragging ? "none" : "width 140ms ease-out",
            }}
          >
            <div style={{ width: widths.right }} className="h-full">
              <AssistantPanel onCollapse={() => void collapseAssistant()} />
            </div>
          </div>
        </div>
      </div>
      {isAssistantCollapsed && (
        <button
          type="button"
          aria-label="Reveal Assistant"
          onClick={revealOrFocusAssistant}
          className="absolute right-3 top-3 z-50 rounded-md border border-[var(--line-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs text-text-secondary shadow-sm hover:bg-surface-hover"
        >
          Assistant
        </button>
      )}
    </div>
  );
}
