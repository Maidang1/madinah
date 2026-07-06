import { create } from "zustand";

export type CommandPaletteIntent = "search" | "create-file";

interface UIState {
  isCommandPaletteOpen: boolean;
  commandPaletteIntent: CommandPaletteIntent;
  commandPaletteSearch: string;
  isDocumentInspectorOpen: boolean;

  openCommandPalette: (intent?: CommandPaletteIntent) => void;
  closeCommandPalette: () => void;
  setCommandPaletteSearch: (search: string) => void;
  openDocumentInspector: () => void;
  closeDocumentInspector: () => void;
  toggleDocumentInspector: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isCommandPaletteOpen: false,
  commandPaletteIntent: "search",
  commandPaletteSearch: "",
  isDocumentInspectorOpen: false,

  openCommandPalette: (intent = "search") =>
    set({ isCommandPaletteOpen: true, commandPaletteIntent: intent, commandPaletteSearch: "" }),
  closeCommandPalette: () =>
    set({
      isCommandPaletteOpen: false,
      commandPaletteIntent: "search",
      commandPaletteSearch: "",
    }),
  setCommandPaletteSearch: (search: string) => set({ commandPaletteSearch: search }),
  openDocumentInspector: () => set({ isDocumentInspectorOpen: true }),
  closeDocumentInspector: () => set({ isDocumentInspectorOpen: false }),
  toggleDocumentInspector: () =>
    set((state) => ({ isDocumentInspectorOpen: !state.isDocumentInspectorOpen })),
}));
