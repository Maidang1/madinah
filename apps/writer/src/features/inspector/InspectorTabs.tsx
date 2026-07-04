import type { KeyboardEvent } from "react";
import type { InspectorTab } from "../workbench/workbench-state";

interface InspectorTabsProps {
  activeTab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
}

const INSPECTOR_TABS: Array<{
  id: InspectorTab;
  label: string;
}> = [
  { id: "outline", label: "Outline" },
  { id: "properties", label: "Properties" },
  { id: "stats", label: "Stats" },
  { id: "review", label: "Review" },
  { id: "history", label: "History" },
];

export function InspectorTabs({ activeTab, onTabChange }: InspectorTabsProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = INSPECTOR_TABS.findIndex((tab) => tab.id === activeTab);
    if (currentIndex < 0) return;

    const nextTab = getNextTab(event.key, currentIndex);
    if (!nextTab) return;

    event.preventDefault();
    onTabChange(nextTab.id);
    requestAnimationFrame(() => {
      document.getElementById(getInspectorTabId(nextTab.id))?.focus();
    });
  };

  return (
    <div
      className="inspector-tabs"
      role="tablist"
      aria-label="Inspector sections"
      onKeyDown={handleKeyDown}
    >
      {INSPECTOR_TABS.map(({ id, label }) => {
        const isActive = id === activeTab;

        return (
          <button
            key={id}
            type="button"
            id={getInspectorTabId(id)}
            className={`inspector-tab${isActive ? " is-active" : ""}`}
            role="tab"
            aria-selected={isActive}
            aria-controls={getInspectorTabPanelId(id)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(id)}
          >
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function getInspectorTabId(tab: InspectorTab): string {
  return `inspector-tab-${tab}`;
}

export function getInspectorTabPanelId(tab: InspectorTab): string {
  return `inspector-tabpanel-${tab}`;
}

function getNextTab(
  key: string,
  currentIndex: number,
): (typeof INSPECTOR_TABS)[number] | null {
  if (key === "Home") return INSPECTOR_TABS[0];
  if (key === "End") return INSPECTOR_TABS[INSPECTOR_TABS.length - 1];
  if (key === "ArrowRight") {
    return INSPECTOR_TABS[(currentIndex + 1) % INSPECTOR_TABS.length];
  }
  if (key === "ArrowLeft") {
    return INSPECTOR_TABS[
      (currentIndex - 1 + INSPECTOR_TABS.length) % INSPECTOR_TABS.length
    ];
  }

  return null;
}
