import { useEffect, useRef } from "react";
import { useUIStore } from "@/stores/ui-store";

export function useIsDocumentInspectorOpen() {
  return useUIStore((s) => s.isDocumentInspectorOpen);
}

export function useOpenDocumentInspector() {
  return useUIStore((s) => s.openDocumentInspector);
}

export function useCloseDocumentInspector() {
  return useUIStore((s) => s.closeDocumentInspector);
}

export function useToggleDocumentInspector() {
  return useUIStore((s) => s.toggleDocumentInspector);
}

export function closeDocumentInspector() {
  useUIStore.getState().closeDocumentInspector();
}

export function toggleDocumentInspector() {
  useUIStore.getState().toggleDocumentInspector();
}

export function useCloseDocumentInspectorOnFileChange(filePath: string | null) {
  const close = useCloseDocumentInspector();
  const previousFilePathRef = useRef<string | null>(filePath);

  useEffect(() => {
    if (previousFilePathRef.current === filePath) return;
    previousFilePathRef.current = filePath;
    close();
  }, [close, filePath]);
}
