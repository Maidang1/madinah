import { describe, expect, it, vi } from "vitest";
import {
  OPEN_DEVELOPER_TOOLS_ACTION_ID,
  createContextMenuTemplate,
  isDevelopmentRuntime,
  withDeveloperToolsMenu,
  type NativeContextMenuItem,
} from "./context-menu";

describe("Electron context menu helpers", () => {
  it("enables developer tools in dev runtime", () => {
    expect(isDevelopmentRuntime({ isPackaged: false })).toBe(true);
    expect(
      isDevelopmentRuntime({
        isPackaged: true,
        rendererUrl: "http://127.0.0.1:1420",
      }),
    ).toBe(true);
    expect(isDevelopmentRuntime({ isPackaged: true })).toBe(false);
  });

  it("adds a developer tools item as a final group", () => {
    const groups: NativeContextMenuItem[][] = [
      [{ id: "editor.format.bold", label: "Bold" }],
    ];

    expect(withDeveloperToolsMenu(groups, false)).toEqual(groups);
    expect(withDeveloperToolsMenu(groups, true)).toEqual([
      groups[0],
      [
        {
          id: OPEN_DEVELOPER_TOOLS_ACTION_ID,
          label: "Open Developer Tools",
        },
      ],
    ]);
  });

  it("routes command menu items through the command callback", () => {
    const onCommand = vi.fn();
    const template = createContextMenuTemplate(
      [[{ id: "developer.openDevTools", label: "Open Developer Tools" }]],
      onCommand,
    );

    template[0].click?.(
      {} as never,
      {} as never,
      {} as never,
    );

    expect(onCommand).toHaveBeenCalledWith("developer.openDevTools");
  });
});
