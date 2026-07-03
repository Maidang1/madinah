export const NATIVE_MENU_EDIT_ROLES = [
  "undo",
  "redo",
  "cut",
  "copy",
  "paste",
  "pasteAndMatchStyle",
  "delete",
  "selectAll",
] as const;

export type NativeMenuEditRole = (typeof NATIVE_MENU_EDIT_ROLES)[number];
