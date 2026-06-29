import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewModeControl } from "./ViewModeControl";

describe("ViewModeControl", () => {
  it("renders Write and Preview as a segmented titlebar control", () => {
    const markup = renderToStaticMarkup(
      <ViewModeControl viewMode="preview" onViewModeChange={() => {}} />,
    );

    expect(markup).toContain('class="writer-view-mode-control"');
    expect(markup).toContain('aria-label="View mode"');
    expect(markup).toContain('data-view-mode-option="write"');
    expect(markup).toContain('data-view-mode-option="preview"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("Write");
    expect(markup).toContain("Preview");
  });
});
