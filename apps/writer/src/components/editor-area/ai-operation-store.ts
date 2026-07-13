import { create } from "zustand";

const DISMISS_AFTER_MS = 4000;

export type AiOperationStatus = "idle" | "running" | "success" | "error";

export interface AiOperationState {
  status: AiOperationStatus;
  label: string;
  detail: string;
}

interface AiOperationStore {
  operation: AiOperationState;
  setOperation: (operation: AiOperationState) => void;
  clearOperation: () => void;
}

const IDLE_OPERATION: AiOperationState = {
  status: "idle",
  label: "",
  detail: "",
};

let dismissTimer: number | null = null;

export const useAiOperationStore = create<AiOperationStore>((set, get) => ({
  operation: IDLE_OPERATION,
  setOperation: (operation) => {
    if (dismissTimer !== null) {
      globalThis.clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    set({ operation });
    if (operation.status === "success" || operation.status === "error") {
      dismissTimer = globalThis.setTimeout(() => {
        dismissTimer = null;
        get().clearOperation();
      }, DISMISS_AFTER_MS);
    }
  },
  clearOperation: () => {
    if (dismissTimer !== null) {
      globalThis.clearTimeout(dismissTimer);
      dismissTimer = null;
    }
    set({ operation: IDLE_OPERATION });
  },
}));

export function setAiOperation(operation: AiOperationState) {
  useAiOperationStore.getState().setOperation(operation);
}

export function clearAiOperation() {
  useAiOperationStore.getState().clearOperation();
}
