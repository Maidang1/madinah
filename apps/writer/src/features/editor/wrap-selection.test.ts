import { describe, expect, it } from "vitest";
import { getWrappedSelection, isWrappingKey } from "./wrap-selection";

describe("wrap-selection", () => {
  it("wraps a selection with the matching closing symbol", () => {
    expect(getWrappedSelection("(", "hello")).toEqual({
      opening: "(",
      closing: ")",
      text: "(hello)",
    });
    expect(getWrappedSelection("`", "code")).toEqual({
      opening: "`",
      closing: "`",
      text: "`code`",
    });
    expect(getWrappedSelection("「", "引用")).toEqual({
      opening: "「",
      closing: "」",
      text: "「引用」",
    });
  });

  it("ignores non-wrapping keys and empty selections", () => {
    expect(getWrappedSelection("a", "hello")).toBeNull();
    expect(getWrappedSelection("*", "hello")).toBeNull();
    expect(getWrappedSelection("(", "")).toBeNull();
  });

  it("reports which keys trigger wrapping", () => {
    expect(isWrappingKey("[")).toBe(true);
    expect(isWrappingKey('"')).toBe(true);
    expect(isWrappingKey("*")).toBe(false);
    expect(isWrappingKey("x")).toBe(false);
  });
});
