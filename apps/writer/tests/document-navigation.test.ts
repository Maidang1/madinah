import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

const openFile = vi.fn(async (_path: string) => undefined);
const getActiveFilePath = vi.fn(() => null as string | null);

vi.mock("../src/hooks/editor-api", () => ({
  openFile: (path: string) => openFile(path),
  getActiveFilePath: () => getActiveFilePath(),
}));

import {
  openDocumentAtCitation,
  registerOpenEditorHeadingScroller,
} from "../src/lib/document-navigation";
import { consumePendingAnchor, setPendingAnchor } from "../src/lib/pending-anchor";

describe("openDocumentAtCitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerOpenEditorHeadingScroller(null);
    // Drain any leftover anchors
    consumePendingAnchor("/workspace/docs/deploy.md");
    getActiveFilePath.mockReturnValue(null);
  });

  test("opens the Document and stages a heading anchor for navigation", async () => {
    await openDocumentAtCitation("/workspace/docs/deploy.md", "blue-gate");
    expect(openFile).toHaveBeenCalledWith("/workspace/docs/deploy.md");
    expect(consumePendingAnchor("/workspace/docs/deploy.md")).toBe("blue-gate");
  });

  test("opens without an anchor when none is provided", async () => {
    await openDocumentAtCitation("/workspace/docs/deploy.md");
    expect(openFile).toHaveBeenCalledWith("/workspace/docs/deploy.md");
    expect(consumePendingAnchor("/workspace/docs/deploy.md")).toBeUndefined();
  });

  test("scrolls the open editor immediately for same-document citations", async () => {
    getActiveFilePath.mockReturnValue("/workspace/docs/deploy.md");
    const scroller = vi.fn(() => true);
    registerOpenEditorHeadingScroller(scroller);

    await openDocumentAtCitation("/workspace/docs/deploy.md", "blue-gate");

    expect(scroller).toHaveBeenCalledWith("/workspace/docs/deploy.md", "blue-gate");
    expect(openFile).not.toHaveBeenCalled();
  });

  test("falls back to open when the same-document scroller cannot find the heading", async () => {
    getActiveFilePath.mockReturnValue("/workspace/docs/deploy.md");
    registerOpenEditorHeadingScroller(() => false);
    // Pre-seed would be wrong; openDocumentAtCitation should set pending then open.
    await openDocumentAtCitation("/workspace/docs/deploy.md", "missing");
    expect(openFile).toHaveBeenCalledWith("/workspace/docs/deploy.md");
    expect(consumePendingAnchor("/workspace/docs/deploy.md")).toBe("missing");
  });
});

describe("pending-anchor bridge", () => {
  test("is single-consume", () => {
    setPendingAnchor("/a.md", "one");
    expect(consumePendingAnchor("/a.md")).toBe("one");
    expect(consumePendingAnchor("/a.md")).toBeUndefined();
  });
});
