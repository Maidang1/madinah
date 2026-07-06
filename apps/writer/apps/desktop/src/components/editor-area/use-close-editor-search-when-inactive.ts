import { useEffect } from "react";
import { closeEditorSearch } from "./editor-search-store";

export function useCloseEditorSearchWhenInactive(isActive: boolean) {
  // isActive derives from store activeTabId mutated by many actions/UI entry points; no single host event handler exists and scattering the side effect would break decoupling.
  /* eslint-disable react-doctor/no-event-handler */
  useEffect(() => {
    if (!isActive) closeEditorSearch();
  }, [isActive]);
  /* eslint-enable react-doctor/no-event-handler */
}
