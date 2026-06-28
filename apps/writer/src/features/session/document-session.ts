import {
  updateDocumentMetadata,
  type DocumentMetadataPatch,
  type MarkdownDocument,
} from "../../domain/document";
import type { WorkspaceInfo } from "../../domain/engine";

export interface DocumentSession {
  document: MarkdownDocument | null;
  lastSavedDocument: MarkdownDocument | null;
  workspace: WorkspaceInfo | null;
  filePath: string | null;
  draftPath: string | null;
  isDirty: boolean;
  draftStatus: "idle" | "saving" | "saved" | "error";
  closeState: "idle" | "confirming";
  error: string | null;
}

export type DocumentSessionAction =
  | {
      type: "openSucceeded";
      document: MarkdownDocument;
      workspace: WorkspaceInfo;
      filePath?: string | null;
    }
  | {
      type: "changeSource";
      source: string;
      timestamp: string;
    }
  | {
      type: "changeMetadata";
      patch: DocumentMetadataPatch;
      timestamp: string;
    }
  | {
      type: "restoreDocument";
      document: MarkdownDocument;
      timestamp: string;
    }
  | {
      type: "saveStarted";
    }
  | {
      type: "saveSucceeded";
      document: MarkdownDocument;
    }
  | {
      type: "saveAsSucceeded";
      document: MarkdownDocument;
      filePath: string;
    }
  | {
      type: "draftSaved";
      draftPath: string;
    }
  | {
      type: "saveFailed";
      error: string;
    }
  | {
      type: "revert";
    }
  | {
      type: "closeRequested";
    }
  | {
      type: "closeConfirmed";
    };

export function createDocumentSession(): DocumentSession {
  return {
    document: null,
    lastSavedDocument: null,
    workspace: null,
    filePath: null,
    draftPath: null,
    isDirty: false,
    draftStatus: "idle",
    closeState: "idle",
    error: null,
  };
}

export function documentSessionReducer(
  state: DocumentSession,
  action: DocumentSessionAction,
): DocumentSession {
  switch (action.type) {
    case "openSucceeded":
      return {
        document: action.document,
        lastSavedDocument: action.document,
        workspace: action.workspace,
        filePath: action.filePath ?? null,
        draftPath: null,
        isDirty: false,
        draftStatus: "saved",
        closeState: "idle",
        error: null,
      };
    case "changeSource":
      if (!state.document) return state;
      return {
        ...state,
        document: {
          ...state.document,
          body: action.source,
          updatedAt: action.timestamp,
        },
        isDirty: true,
        draftStatus: "idle",
        error: null,
      };
    case "changeMetadata":
      if (!state.document) return state;
      return {
        ...state,
        document: updateDocumentMetadata(
          state.document,
          action.patch,
          action.timestamp,
        ),
        isDirty: true,
        draftStatus: "idle",
        error: null,
      };
    case "restoreDocument":
      if (!state.document) return state;
      return {
        ...state,
        document: {
          ...action.document,
          updatedAt: action.timestamp,
        },
        isDirty: true,
        draftStatus: "idle",
        error: null,
      };
    case "saveStarted":
      return {
        ...state,
        draftStatus: "saving",
        error: null,
      };
    case "saveSucceeded":
      return {
        ...state,
        document: action.document,
        lastSavedDocument: action.document,
        isDirty: false,
        draftStatus: "saved",
        closeState: "idle",
        error: null,
      };
    case "saveAsSucceeded":
      return {
        ...state,
        document: action.document,
        lastSavedDocument: action.document,
        filePath: action.filePath,
        isDirty: false,
        draftStatus: "saved",
        closeState: "idle",
        error: null,
      };
    case "draftSaved":
      return {
        ...state,
        draftPath: action.draftPath,
        draftStatus: "saved",
        error: null,
      };
    case "saveFailed":
      return {
        ...state,
        draftStatus: "error",
        error: action.error,
      };
    case "revert":
      return {
        ...state,
        document: state.lastSavedDocument,
        isDirty: false,
        draftStatus: "saved",
        closeState: "idle",
        error: null,
      };
    case "closeRequested":
      if (!state.isDirty) {
        return createDocumentSession();
      }

      return {
        ...state,
        closeState: "confirming",
      };
    case "closeConfirmed":
      return createDocumentSession();
  }
}
