import { describe, expect, it } from "vitest";
import {
  clampWorkbenchPaneWidth,
  getInitialWorkbenchPaneWidths,
  getKeyboardWorkbenchPaneWidth,
  getResizedWorkbenchPaneWidth,
  persistWorkbenchPaneWidth,
} from "./workbench-layout";
import type { WorkbenchStorage } from "./workbench-state";

describe("workbench layout", () => {
  it("loads persisted pane widths with defaults and bounds", () => {
    expect(getInitialWorkbenchPaneWidths(createStorage())).toEqual({
      sidebar: 280,
      inspector: 260,
    });
    expect(
      getInitialWorkbenchPaneWidths(
        createStorage({
          "madinah-writer-sidebar-width": "360",
          "madinah-writer-inspector-width": "900",
        }),
      ),
    ).toEqual({
      sidebar: 360,
      inspector: 520,
    });
    expect(
      getInitialWorkbenchPaneWidths(
        createStorage({
          "madinah-writer-sidebar-width": "wide",
          "madinah-writer-inspector-width": "180",
        }),
      ),
    ).toEqual({
      sidebar: 280,
      inspector: 240,
    });
  });

  it("calculates drag widths from each divider direction", () => {
    expect(
      getResizedWorkbenchPaneWidth({
        pane: "sidebar",
        startWidth: 280,
        startClientX: 300,
        currentClientX: 340,
      }),
    ).toBe(320);
    expect(
      getResizedWorkbenchPaneWidth({
        pane: "inspector",
        startWidth: 260,
        startClientX: 900,
        currentClientX: 860,
      }),
    ).toBe(300);
  });

  it("supports keyboard resizing and clamps values", () => {
    expect(
      getKeyboardWorkbenchPaneWidth({
        pane: "sidebar",
        currentWidth: 280,
        key: "ArrowRight",
      }),
    ).toBe(296);
    expect(
      getKeyboardWorkbenchPaneWidth({
        pane: "inspector",
        currentWidth: 260,
        key: "ArrowLeft",
      }),
    ).toBe(276);
    expect(
      getKeyboardWorkbenchPaneWidth({
        pane: "inspector",
        currentWidth: 260,
        key: "Escape",
      }),
    ).toBeNull();
    expect(
      getKeyboardWorkbenchPaneWidth({
        pane: "sidebar",
        currentWidth: 280,
        key: "Home",
      }),
    ).toBe(220);
    expect(
      getKeyboardWorkbenchPaneWidth({
        pane: "inspector",
        currentWidth: 280,
        key: "End",
      }),
    ).toBe(520);
  });

  it("persists clamped widths", () => {
    const storage = createStorage();

    persistWorkbenchPaneWidth("sidebar", 100, storage);
    persistWorkbenchPaneWidth("inspector", 300, storage);

    expect(storage.getItem("madinah-writer-sidebar-width")).toBe("220");
    expect(storage.getItem("madinah-writer-inspector-width")).toBe("300");
    expect(clampWorkbenchPaneWidth("sidebar", Number.POSITIVE_INFINITY)).toBe(280);
  });
});

function createStorage(initial: Record<string, string> = {}): WorkbenchStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}
