import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ViewModeControl } from "./ViewModeControl";

describe("ViewModeControl", () => {
  it("renders one icon button that toggles the view mode", () => {
    const markup = renderToStaticMarkup(
      <ViewModeControl viewMode="preview" onViewModeChange={() => {}} />,
    );

    expect(markup).toContain('class="writer-view-mode-toggle"');
    expect(markup).toContain('data-view-mode-toggle="preview"');
    expect(markup).toContain('aria-label="Write"');
    expect(markup).not.toContain('data-view-mode-option=');
  });
});
