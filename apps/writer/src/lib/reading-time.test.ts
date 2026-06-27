import { describe, expect, it } from "vitest";
import { calculateReadingTime } from "./reading-time";

describe("reading time", () => {
  it("matches the blog reading-time behavior for MDX content", () => {
    const result = calculateReadingTime(
      "one two `ignored` [three](https://example.com)\n```ts\nignored block\n```",
    );

    expect(result).toEqual({
      text: "1 min read",
      minutes: 1,
      time: 900,
      words: 3,
    });
  });
});
