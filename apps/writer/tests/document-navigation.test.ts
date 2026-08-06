import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

const openFile = vi.fn(async (_path: string) => undefined);
const getActiveFilePath = vi.fn(() => null as string | null);

vi.mock("../src/hooks/editor-api", () => ({
  openFile: (path: string) => openFile(path),
  getActiveFilePath: () => getActiveFilePath(),
}));

import {
  clearOpenEditorHeadingScrollersForTests,
  getOpenEditorHeadingScroller,
  openDocumentAtCitation,
  registerOpenEditorHeadingScroller,
} from "../src/lib/document-navigation";
import { consumePendingAnchor, setPendingAnchor } from "../src/lib/pending-anchor";

describe("openDocumentAtCitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearOpenEditorHeadingScrollersForTests();
    consumePendingAnchor("/workspace/docs/deploy.md");
    consumePendingAnchor("/workspace/notes/runbook.mdx");
    getActiveFilePath.mockReturnValue(null);
  });

  test("opens the Document and stages a heading anchor for navigation", async () => {
    const result = await openDocumentAtCitation("/workspace/docs/deploy.md", "blue-gate");
    expect(openFile).toHaveBeenCalledWith("/workspace/docs/deploy.md");
    expect(result).toEqual({ status: "pending" });
    expect(consumePendingAnchor("/workspace/docs/deploy.md")).toBe("blue-gate");
  });

  test("opens without an anchor when none is provided", async () => {
    const result = await openDocumentAtCitation("/workspace/docs/deploy.md");
    expect(openFile).toHaveBeenCalledWith("/workspace/docs/deploy.md");
    expect(result).toEqual({ status: "opened" });
    expect(consumePendingAnchor("/workspace/docs/deploy.md")).toBeUndefined();
  });

  test("scrolls the open editor immediately for same-document citations without openFile", async () => {
    getActiveFilePath.mockReturnValue("/workspace/docs/deploy.md");
    const scroller = vi.fn(() => true);
    registerOpenEditorHeadingScroller("/workspace/docs/deploy.md", scroller);

    const result = await openDocumentAtCitation("/workspace/docs/deploy.md", "blue-gate");

    expect(scroller).toHaveBeenCalledWith("blue-gate");
    expect(openFile).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "scrolled" });
    expect(consumePendingAnchor("/workspace/docs/deploy.md")).toBeUndefined();
  });

  test("same-document scroller miss does not call openFile or leave a stuck pending anchor", async () => {
    getActiveFilePath.mockReturnValue("/workspace/docs/deploy.md");
    registerOpenEditorHeadingScroller("/workspace/docs/deploy.md", () => false);
    setPendingAnchor("/workspace/docs/deploy.md", "stale");

    const result = await openDocumentAtCitation("/workspace/docs/deploy.md", "missing");

    expect(openFile).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "missing-anchor",
      path: "/workspace/docs/deploy.md",
      anchor: "missing",
    });
    expect(consumePendingAnchor("/workspace/docs/deploy.md")).toBeUndefined();
  });

  test("same-document with no registered scroller reports missing-anchor without openFile", async () => {
    getActiveFilePath.mockReturnValue("/workspace/docs/deploy.md");

    const result = await openDocumentAtCitation("/workspace/docs/deploy.md", "intro");

    expect(openFile).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "missing-anchor",
      path: "/workspace/docs/deploy.md",
      anchor: "intro",
    });
  });

  test("path-scoped scrollers resolve independently for multi-tab keep-alive", async () => {
    const deploy = vi.fn(() => true);
    const runbook = vi.fn(() => true);
    registerOpenEditorHeadingScroller("/workspace/docs/deploy.md", deploy);
    registerOpenEditorHeadingScroller("/workspace/notes/runbook.mdx", runbook);

    getActiveFilePath.mockReturnValue("/workspace/notes/runbook.mdx");
    await openDocumentAtCitation("/workspace/notes/runbook.mdx", "setup");
    expect(runbook).toHaveBeenCalledWith("setup");
    expect(deploy).not.toHaveBeenCalled();

    getActiveFilePath.mockReturnValue("/workspace/docs/deploy.md");
    await openDocumentAtCitation("/workspace/docs/deploy.md", "blue-gate");
    expect(deploy).toHaveBeenCalledWith("blue-gate");
  });

  test("unregistering one path leaves the other scroller intact", async () => {
    const deploy = vi.fn(() => true);
    const runbook = vi.fn(() => true);
    registerOpenEditorHeadingScroller("/workspace/docs/deploy.md", deploy);
    registerOpenEditorHeadingScroller("/workspace/notes/runbook.mdx", runbook);
    registerOpenEditorHeadingScroller("/workspace/docs/deploy.md", null);

    expect(getOpenEditorHeadingScroller("/workspace/docs/deploy.md")).toBeUndefined();
    expect(getOpenEditorHeadingScroller("/workspace/notes/runbook.mdx")).toBe(runbook);

    getActiveFilePath.mockReturnValue("/workspace/notes/runbook.mdx");
    await openDocumentAtCitation("/workspace/notes/runbook.mdx", "setup");
    expect(runbook).toHaveBeenCalledWith("setup");
  });

  test("after open, keep-alive scroller is used and pending is consumed", async () => {
    const scroller = vi.fn(() => true);
    registerOpenEditorHeadingScroller("/workspace/docs/deploy.md", scroller);
    getActiveFilePath.mockReturnValue("/workspace/other.md");

    const result = await openDocumentAtCitation("/workspace/docs/deploy.md", "blue-gate");

    expect(openFile).toHaveBeenCalledWith("/workspace/docs/deploy.md");
    expect(scroller).toHaveBeenCalledWith("blue-gate");
    expect(result).toEqual({ status: "scrolled" });
    expect(consumePendingAnchor("/workspace/docs/deploy.md")).toBeUndefined();
  });
});

describe("pending-anchor bridge", () => {
  test("is single-consume", () => {
    setPendingAnchor("/a.md", "one");
    expect(consumePendingAnchor("/a.md")).toBe("one");
    expect(consumePendingAnchor("/a.md")).toBeUndefined();
  });
});
