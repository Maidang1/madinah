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
  // Monotonic counter bumped only when the editor's content is replaced from
  // OUTSIDE the editor (open / restore / revert). User keystrokes and saves do
  // NOT bump it. The editor uses this to decide when to imperatively reset its
  // (uncontrolled) content, so self-edits never trigger a reset — see the
  // reset effect in MarkdownEditor.tsx.
  contentEpoch: number;
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
      // The document snapshot that was actually written. May be stale if the
      // user kept typing during the async save.
      document: MarkdownDocument;
      // The exact `state.document` reference captured when the save started.
      // Used to detect whether the document changed during the save so we do
      // not clobber newer edits with the stale snapshot. Optional for callers
      // (e.g. saveNow) that save the current document synchronously.
      savedFrom?: MarkdownDocument | null;
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
    contentEpoch: 0,
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
        // External content replacement — reset the editor to this document.
        contentEpoch: state.contentEpoch + 1,
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
        // Restoring a prior version replaces the editor content externally.
        contentEpoch: state.contentEpoch + 1,
      };
    case "saveSucceeded": {
      // If the user kept editing while the (async) save was in flight, the
      // current document is newer than the written snapshot. Overwriting
      // `document` with the stale snapshot would revert those edits and force
      // the editor to reset its content (a visible flicker + lost keystrokes).
      // In that case keep the current document and stay dirty; only record
      // that the snapshot was persisted.
      const savedStaleSnapshot =
        action.savedFrom != null && state.document !== action.savedFrom;
      if (savedStaleSnapshot) {
        return {
          ...state,
          lastSavedDocument: action.document,
          error: null,
        };
      }
      return {
        ...state,
        document: action.document,
        lastSavedDocument: action.document,
        isDirty: false,
        error: null,
      };
    }
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
        // Revert swaps the editor content back to the last saved version.
        contentEpoch: state.contentEpoch + 1,
      };
    case "closeConfirmed":
      return createDocumentSession();
  }
}
