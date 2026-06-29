import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WritingStats } from "./WritingStats";

describe("WritingStats", () => {
  it("renders writing metrics as compact rows with full labels", () => {
    const markup = renderToStaticMarkup(
      <WritingStats
        items={[
          { id: "words", label: "Words", value: 1200 },
          { id: "characters", label: "Chars", value: 3500 },
          { id: "blocks", label: "Blocks", value: 12 },
          { id: "headings", label: "Headings", value: 4 },
          { id: "links", label: "Links", value: 3 },
          { id: "images", label: "Images", value: 1 },
          { id: "readingMinutes", label: "Read Min", value: 6 },
        ]}
      />,
    );

    expect(markup).toContain('class="inspector-stat-list"');
    expect(markup.match(/class="inspector-stat-row"/g)).toHaveLength(7);
    expect(markup).toContain("Characters");
    expect(markup).toContain("Read minutes");
    expect(markup).toContain('class="inspector-stat-value">3,500</strong>');
    expect(markup).toContain('aria-label="Writing metrics"');
  });
});
