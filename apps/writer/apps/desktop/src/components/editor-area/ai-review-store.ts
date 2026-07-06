import { create } from "zustand";
import type { AiDocumentReview } from "@/lib/tauri";

export type AiReviewStatus = "idle" | "loading" | "ready" | "error";

export interface AiReviewState {
  status: AiReviewStatus;
  filePath: string | null;
  message: string;
  review: AiDocumentReview | null;
  updatedAt: string | null;
}

interface AiReviewStore {
  reviewState: AiReviewState;
  setReviewState: (state: AiReviewState) => void;
  clearReviewState: () => void;
}

const IDLE_REVIEW_STATE: AiReviewState = {
  status: "idle",
  filePath: null,
  message: "",
  review: null,
  updatedAt: null,
};

export const useAiReviewStore = create<AiReviewStore>((set) => ({
  reviewState: IDLE_REVIEW_STATE,
  setReviewState: (reviewState) => set({ reviewState }),
  clearReviewState: () => set({ reviewState: IDLE_REVIEW_STATE }),
}));

export function setAiReviewState(state: AiReviewState) {
  useAiReviewStore.getState().setReviewState(state);
}

export function clearAiReviewState() {
  useAiReviewStore.getState().clearReviewState();
}
