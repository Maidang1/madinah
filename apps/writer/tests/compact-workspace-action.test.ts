import { beforeEach, describe, expect, test, vi } from "vite-plus/test";

vi.mock("../src/lib/tauri", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/tauri")>()),
  openWorkspaceInNewWindow: vi.fn(),
}));

import * as tauri from "../src/lib/tauri";
import { openContainingWorkspaceForFile } from "../src/hooks/use-open-drop";

describe("compact file Workspace action", () => {
  beforeEach(() => vi.clearAllMocks());

  test("explicitly opens the containing folder and preserves the active file", async () => {
    vi.mocked(tauri.openWorkspaceInNewWindow).mockResolvedValue();

    await openContainingWorkspaceForFile("/notes/drafts/article.md");

    expect(tauri.openWorkspaceInNewWindow).toHaveBeenCalledWith(
      "/notes/drafts",
      "/notes/drafts/article.md",
    );
  });
});
