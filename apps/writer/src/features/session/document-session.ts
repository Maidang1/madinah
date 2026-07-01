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
  isDirty: boolean;
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
      type: "saveSucceeded";
      document: MarkdownDocument;
    }
  | {
      type: "saveFailed";
      error: string;
    }
  | {
      type: "revert";
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
    isDirty: false,
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
        isDirty: false,
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
        error: null,
      };
    case "saveSucceeded":
      return {
        ...state,
        document: action.document,
        lastSavedDocument: action.document,
        isDirty: false,
        error: null,
      };
    case "saveFailed":
      return {
        ...state,
        error: action.error,
      };
    case "revert":
      return {
        ...state,
        document: state.lastSavedDocument,
        isDirty: false,
        error: null,
      };
    case "closeConfirmed":
      return createDocumentSession();
  }
}
