import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getInspectorTabId,
  getInspectorTabPanelId,
  InspectorTabs,
} from "./InspectorTabs";

describe("InspectorTabs", () => {
  it("renders the four inspector sections as a stable tablist", () => {
    const markup = renderToStaticMarkup(
      <InspectorTabs activeTab="stats" onTabChange={() => {}} />,
    );

    expect(markup).toContain('role="tablist"');
    expect(markup.match(/role="tab"/g)).toHaveLength(4);
    expect(markup).toContain('id="inspector-tab-outline"');
    expect(markup).toContain('id="inspector-tab-properties"');
    expect(markup).toContain('id="inspector-tab-stats"');
    expect(markup).toContain('id="inspector-tab-history"');
    expect(markup).toContain('aria-controls="inspector-tabpanel-stats"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('class="inspector-tab is-active"');
    expect(markup).toContain("Properties");
    expect(markup).toContain("History");
  });

  it("keeps tab and panel ids paired", () => {
    expect(getInspectorTabId("outline")).toBe("inspector-tab-outline");
    expect(getInspectorTabPanelId("outline")).toBe("inspector-tabpanel-outline");
  });
});
