import { useSettingsStore } from "@/stores/settings-store";

export function revealOrFocusAssistant() {
  const settings = useSettingsStore.getState();
  const isVisible = settings.settings["appearance.assistant-visible"] !== false;
  if (!isVisible) {
    void settings.setSetting("appearance.assistant-visible", true).then(focusAssistant);
    return;
  }
  focusAssistant();
}

export function useIsAssistantCollapsed() {
  const isVisible = useSettingsStore(
    (state) => (state.settings["appearance.assistant-visible"] as boolean | undefined) ?? true,
  );
  return !isVisible;
}

export function useAssistantWidth() {
  return (
    useSettingsStore(
      (state) => state.settings["appearance.assistant-width"] as number | undefined,
    ) ?? 320
  );
}

export function useSetAssistantWidth() {
  const setSetting = useSettingsStore((state) => state.setSetting);
  return (nextWidth: number) => setSetting("appearance.assistant-width", nextWidth);
}

export function useCollapseAssistant() {
  const setSetting = useSettingsStore((state) => state.setSetting);
  return () => setSetting("appearance.assistant-visible", false);
}

function focusAssistant() {
  window.requestAnimationFrame(() => {
    document.getElementById("assistant-panel")?.focus();
  });
}
