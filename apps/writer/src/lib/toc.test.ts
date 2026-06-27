import { describe, expect, it } from "vitest";
import { buildToc, headingToId } from "./toc";

describe("table of contents", () => {
  it("builds the same heading ids as the Astro blog page", () => {
    expect(headingToId("Codex `Skills` flow")).toBe("codex-skills-flow");
    expect(headingToId("[Rust async](https://example.com) 入门")).toBe(
      "rust-async-入门",
    );
  });

  it("collects h1-h3 headings and ignores deeper headings", () => {
    const toc = buildToc(`# Title

## Two

### Three

#### Four
`);

    expect(toc).toEqual([
      { depth: 1, text: "Title", id: "title" },
      { depth: 2, text: "Two", id: "two" },
      { depth: 3, text: "Three", id: "three" },
    ]);
  });
});
