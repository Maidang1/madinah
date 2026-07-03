import { describe, expect, it } from "vitest";
import {
  findDocumentMatches,
  getAdjacentMatchIndex,
  getCenteredSearchScrollTop,
  getNthTextMatch,
  replaceAllInSource,
  replaceNthInSource,
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

  it("finds the nth text occurrence used for DOM range targeting", () => {
    expect(getNthTextMatch("Alpha beta alpha", "alpha", 1)).toEqual({
      start: 11,
      end: 16,
    });
    expect(getNthTextMatch("Alpha beta", "Alpha", 0, { caseSensitive: true })).toEqual({
      start: 0,
      end: 5,
    });
    expect(getNthTextMatch("Alpha beta", "alpha", 0, { caseSensitive: true })).toBeNull();
    expect(getNthTextMatch("Alpha beta", "alpha", 0)).toEqual({
      start: 0,
      end: 5,
    });
  });

  it("computes a scroll target that centers the active match", () => {
    expect(
      getCenteredSearchScrollTop({
        containerTop: 100,
        containerHeight: 400,
        currentScrollTop: 240,
        targetTop: 500,
        targetHeight: 20,
      }),
    ).toBe(450);
  });

  it("replaces the nth occurrence in place", () => {
    expect(replaceNthInSource("alpha beta alpha", "alpha", "GAMMA", 1)).toBe(
      "alpha beta GAMMA",
    );
    // Non-matching index leaves the source untouched.
    expect(replaceNthInSource("alpha", "beta", "x", 0)).toBe("alpha");
  });

  it("replaces every occurrence and reports the count", () => {
    expect(replaceAllInSource("a A a", "a", "b")).toEqual({
      source: "b b b",
      count: 3,
    });
    expect(
      replaceAllInSource("a A a", "a", "b", { caseSensitive: true }),
    ).toEqual({ source: "b A b", count: 2 });
    // Empty query is a no-op rather than inserting between every character.
    expect(replaceAllInSource("abc", "", "x")).toEqual({
      source: "abc",
      count: 0,
    });
  });
});
