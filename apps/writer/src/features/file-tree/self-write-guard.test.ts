import { describe, expect, it } from "vitest";
import {
  markSelfWrittenFilePath,
  shouldIgnoreSelfWrittenFileTreeChange,
} from "./self-write-guard";

describe("self-write file tree guard", () => {
  it("ignores a file tree event caused by a recent local save", () => {
    const writes = new Map<string, number>();

    markSelfWrittenFilePath(writes, "/workspace/post.md", 1_000);

    expect(
      shouldIgnoreSelfWrittenFileTreeChange(
        writes,
        "/workspace/post.md",
        2_000,
      ),
    ).toBe(true);
  });

  it("allows stale or unrelated file tree events", () => {
    const writes = new Map<string, number>();

    markSelfWrittenFilePath(writes, "/workspace/post.md", 1_000);

    expect(
      shouldIgnoreSelfWrittenFileTreeChange(
        writes,
        "/workspace/post.md",
        4_000,
      ),
    ).toBe(false);
    expect(
      shouldIgnoreSelfWrittenFileTreeChange(
        writes,
        "/workspace/other.md",
        4_000,
      ),
    ).toBe(false);
  });
});
