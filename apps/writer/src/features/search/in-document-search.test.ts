import { describe, expect, it } from "vitest";
import {
  findDocumentMatches,
  getAdjacentMatchIndex,
} from "./in-document-search";

describe("in-document search", () => {
  it("finds case-insensitive matches with line and column metadata", () => {
    const matches = findDocumentMatches("# Title\n\nAlpha beta\nalpha again", "alpha");

    expect(matches).toEqual([
      {
        index: 9,
        length: 5,
        line: 3,
        column: 1,
        preview: "Alpha beta",
      },
      {
        index: 20,
        length: 5,
        line: 4,
        column: 1,
        preview: "alpha again",
      },
    ]);
  });

  it("supports case-sensitive matching", () => {
    expect(
      findDocumentMatches("Alpha alpha", "Alpha", { caseSensitive: true }),
    ).toHaveLength(1);
  });

  it("wraps adjacent match navigation", () => {
    expect(getAdjacentMatchIndex(0, 3, "previous")).toBe(2);
    expect(getAdjacentMatchIndex(2, 3, "next")).toBe(0);
    expect(getAdjacentMatchIndex(-1, 3, "next")).toBe(0);
  });
});
