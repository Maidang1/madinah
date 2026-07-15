import { Menu } from "@tauri-apps/api/menu/menu";
import { PredefinedMenuItem } from "@tauri-apps/api/menu/predefinedMenuItem";
import { MenuItem } from "@tauri-apps/api/menu/menuItem";
import { Submenu } from "@tauri-apps/api/menu/submenu";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import {
  detectPlatform,
  revealLabelForPlatform,
  type Platform,
} from "@/components/sidebar/context-menu-utils";

// -- Tab menu --

export type TabMenuActionId =
  | "close"
  | "close-others"
  | "close-all"
  | "reveal-in-sidebar"
  | "copy-path";

export interface TabMenuHandlers {
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onRevealInSidebar: () => void;
  onCopyPath: () => void;
}

export function buildTabMenuItemsSpec(
  handlers: TabMenuHandlers,
): Array<
  { kind: "item"; id: TabMenuActionId; text: string; action: () => void } | { kind: "separator" }
> {
  return [
    { kind: "item", id: "close", text: "Close", action: handlers.onClose },
    { kind: "item", id: "close-others", text: "Close others", action: handlers.onCloseOthers },
    { kind: "item", id: "close-all", text: "Close all", action: handlers.onCloseAll },
    { kind: "separator" },
    {
      kind: "item",
      id: "reveal-in-sidebar",
      text: "Reveal in sidebar",
      action: handlers.onRevealInSidebar,
    },
    { kind: "item", id: "copy-path", text: "Copy path", action: handlers.onCopyPath },
  ];
}

// -- Document title menu --

export type TitleMenuActionId = "rename" | "reveal" | "copy-path";

export interface TitleMenuHandlers {
  onRename: () => void;
  onReveal: () => void;
  onCopyPath: () => void;
}

export function buildTitleMenuItemsSpec(
  handlers: TitleMenuHandlers,
  platform: Platform = detectPlatform(),
): Array<
  { kind: "item"; id: TitleMenuActionId; text: string; action: () => void } | { kind: "separator" }
> {
  return [
    { kind: "item", id: "rename", text: "Rename", action: handlers.onRename },
    {
      kind: "item",
      id: "reveal",
      text: revealLabelForPlatform(platform),
      action: handlers.onReveal,
    },
    { kind: "item", id: "copy-path", text: "Copy path", action: handlers.onCopyPath },
  ];
}

// -- Shared popup helper --

export type MenuItemSpec =
  | { kind: "item"; id: string; text: string; action: () => void; accelerator?: string }
  | { kind: "separator" }
  | { kind: "submenu"; text: string; items: MenuItemSpec[] };

async function buildMenuItems(
  spec: MenuItemSpec[],
): Promise<Array<MenuItem | PredefinedMenuItem | Submenu>> {
  return Promise.all(
    spec.map(async (entry) => {
      if (entry.kind === "separator") {
        return PredefinedMenuItem.new({ item: "Separator" });
      }
      if (entry.kind === "submenu") {
        const children = await buildMenuItems(entry.items);
        return Submenu.new({ text: entry.text, items: children });
      }
      return MenuItem.new({
        id: entry.id,
        text: entry.text,
        action: entry.action,
        ...(entry.accelerator ? { accelerator: entry.accelerator } : {}),
      });
    }),
  );
}

export async function showNativeContextMenu(
  spec: MenuItemSpec[],
  at?: { x: number; y: number },
): Promise<void> {
  const items = await buildMenuItems(spec);
  const menu = await Menu.new({ items });
  if (at) {
    await menu.popup(new LogicalPosition(at.x, at.y));
  } else {
    await menu.popup();
  }
}
