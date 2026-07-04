import type { MenuItemConstructorOptions } from "electron";
import type { NativeMenuEditRole } from "../shared/native-menu";

export const OPEN_DEVELOPER_TOOLS_ACTION_ID = "developer.openDevTools";

export type NativeContextMenuItem =
  | {
      id: string;
      label: string;
      disabled?: boolean;
    }
  | {
      role: NativeMenuEditRole;
      label?: string;
      disabled?: boolean;
    };

export interface NativeContextMenuRequest {
  groups: NativeContextMenuItem[][];
  position: { x: number; y: number };
}

export interface RuntimeModeInput {
  isPackaged: boolean;
  rendererUrl?: string;
}

export function isDevelopmentRuntime(input: RuntimeModeInput): boolean {
  return !input.isPackaged || Boolean(input.rendererUrl);
}

export function withDeveloperToolsMenu(
  groups: NativeContextMenuItem[][],
  includeDeveloperTools: boolean,
): NativeContextMenuItem[][] {
  if (!includeDeveloperTools) return groups;

  return [
    ...groups,
    [
      {
        id: OPEN_DEVELOPER_TOOLS_ACTION_ID,
        label: "Open Developer Tools",
      },
    ],
  ];
}

export function createContextMenuTemplate(
  groups: NativeContextMenuItem[][],
  onCommand: (id: string) => void,
): MenuItemConstructorOptions[] {
  return groups.flatMap((group, groupIndex) => [
    ...(groupIndex > 0 ? [{ type: "separator" as const }] : []),
    ...group.map((item) => {
      if ("role" in item) {
        return {
          role: item.role,
          label: item.label,
          ...(item.disabled === undefined ? {} : { enabled: !item.disabled }),
        };
      }

      return {
        label: item.label,
        enabled: !item.disabled,
        click: () => onCommand(item.id),
      };
    }),
  ]);
}
