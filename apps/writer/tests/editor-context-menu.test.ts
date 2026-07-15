import { describe, expect, test, vi } from "vite-plus/test";

vi.mock("@tauri-apps/api/menu/menu", () => ({ Menu: { new: vi.fn() } }));
vi.mock("@tauri-apps/api/menu/predefinedMenuItem", () => ({
  PredefinedMenuItem: { new: vi.fn() },
}));
vi.mock("@tauri-apps/api/menu/menuItem", () => ({ MenuItem: { new: vi.fn() } }));
vi.mock("@tauri-apps/api/menu/submenu", () => ({ Submenu: { new: vi.fn() } }));

import {
  buildTabMenuItemsSpec,
  buildTitleMenuItemsSpec,
  type TabMenuHandlers,
  type TitleMenuHandlers,
} from "../src/components/editor-area/editor-context-menu";

function makeTabHandlers(): TabMenuHandlers & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    onClose: () => calls.push("close"),
    onCloseOthers: () => calls.push("close-others"),
    onCloseAll: () => calls.push("close-all"),
    onRevealInSidebar: () => calls.push("reveal-in-sidebar"),
    onCopyPath: () => calls.push("copy-path"),
  };
}

function makeTitleHandlers(): TitleMenuHandlers & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    onRename: () => calls.push("rename"),
    onReveal: () => calls.push("reveal"),
    onCopyPath: () => calls.push("copy-path"),
  };
}

describe("buildTabMenuItemsSpec", () => {
  test("emits items in order and invokes matching handlers", () => {
    const handlers = makeTabHandlers();
    const spec = buildTabMenuItemsSpec(handlers);
    expect(spec.map((entry) => (entry.kind === "separator" ? "---" : entry.id))).toEqual([
      "close",
      "close-others",
      "close-all",
      "---",
      "reveal-in-sidebar",
      "copy-path",
    ]);
    for (const entry of spec) if (entry.kind === "item") entry.action();
    expect(handlers.calls).toEqual([
      "close",
      "close-others",
      "close-all",
      "reveal-in-sidebar",
      "copy-path",
    ]);
  });
});

describe("buildTitleMenuItemsSpec", () => {
  test("uses platform-specific reveal labels and invokes handlers", () => {
    const handlers = makeTitleHandlers();
    const spec = buildTitleMenuItemsSpec(handlers, "macos");
    const reveal = spec.find((entry) => entry.kind === "item" && entry.id === "reveal");
    expect(reveal && reveal.kind === "item" ? reveal.text : null).toBe("Reveal in Finder");
    for (const entry of spec) if (entry.kind === "item") entry.action();
    expect(handlers.calls).toEqual(["rename", "reveal", "copy-path"]);
  });
});
