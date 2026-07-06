import { describe, expect, test } from "vite-plus/test";
import { applyAiMetadataToFrontmatter } from "../src/lib/ai-metadata";

describe("AI metadata frontmatter merge", () => {
  test("updates generated fields and preserves unrelated frontmatter", () => {
    const yaml = applyAiMetadataToFrontmatter(
      "title: Old\nauthor: Madinah\npubDate: 2026-07-05 10:00:00\nstatus: published",
      {
        title: "New Title",
        description: "Generated description.",
        tags: ["AI", "writer", "ai"],
        slug: "new-title",
      },
    );

    expect(yaml).toContain("title: New Title");
    expect(yaml).toContain("author: Madinah");
    expect(yaml).toContain("pubDate: 2026-07-05 10:00:00");
    expect(yaml).toContain("status: published");
    expect(yaml).toContain("description: Generated description.");
    expect(yaml).toContain("slug: new-title");
    expect(yaml).toContain("tags:");
    expect(yaml).toContain("- ai");
    expect(yaml).toContain("- writer");
  });

  test("creates frontmatter when the document has none", () => {
    const yaml = applyAiMetadataToFrontmatter(null, {
      title: "Madinah AI",
      description: "Generated description.",
      tags: ["agent"],
      slug: "madinah-ai",
    });

    expect(yaml).toContain("title: Madinah AI");
    expect(yaml).toContain("description: Generated description.");
    expect(yaml).toContain("slug: madinah-ai");
  });

  test("rejects invalid existing YAML", () => {
    expect(() =>
      applyAiMetadataToFrontmatter("title: [unterminated", {
        title: "Madinah AI",
        description: "Generated description.",
        tags: ["agent"],
        slug: "madinah-ai",
      }),
    ).toThrow("Frontmatter YAML is invalid");
  });
});
