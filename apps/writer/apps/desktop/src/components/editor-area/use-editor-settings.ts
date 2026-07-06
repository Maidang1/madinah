import { useCallback } from "react";
import { useSetting } from "@/hooks/use-settings";

/** Editor-scoped settings that don't fit the generic `cssVar` binding flow.
 *  CSS-var-driven settings (font-size, line-height, …) declare their var in
 *  the JSON schema and get pushed to :root by `applyCssVarBindings`. This
 *  hook only handles values that need conversion before becoming CSS. */
export function useEditorSettingsRef() {
  const editorWidth = useSetting("appearance.editor-width");

  return useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      el.style.setProperty(
        "--writer-editor-max-width",
        editorWidth === "full" ? "var(--reader-content-width)" : "720px",
      );
    },
    [editorWidth],
  );
}
