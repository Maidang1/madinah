import type { DocumentSession } from "../session/document-session";

export type SaveSemanticState =
  | "edited"
  | "draft-saved"
  | "file-saved"
  | "app-saved"
  | "saving"
  | "opening"
  | "creating"
  | "error";

export type SavePresentationIcon =
  | "pencil"
  | "file-clock"
  | "file-check"
  | "check"
  | "loader"
  | "alert";

export interface SavePresentation {
  state: SaveSemanticState;
  label: string;
  tooltip: string;
  icon: SavePresentationIcon;
  tone: "edited" | "draft" | "saved" | "busy" | "error";
  isBusy: boolean;
}

export function getSavePresentation(
  session: DocumentSession,
  status: string,
): SavePresentation {
  if (session.draftStatus === "error" || session.error) {
    const error = session.error || status;
    return {
      state: "error",
      label: "Save failed",
      tooltip: error ? `Save failed: ${error}` : "Save failed",
      icon: "alert",
      tone: "error",
      isBusy: false,
    };
  }

  if (session.draftStatus === "saving" || status === "Saving") {
    return {
      state: "saving",
      label: "Saving",
      tooltip: "Saving",
      icon: "loader",
      tone: "busy",
      isBusy: true,
    };
  }

  if (status === "Opening") {
    return {
      state: "opening",
      label: "Opening",
      tooltip: "Opening",
      icon: "loader",
      tone: "busy",
      isBusy: true,
    };
  }

  if (status === "Creating") {
    return {
      state: "creating",
      label: "Creating",
      tooltip: "Creating",
      icon: "loader",
      tone: "busy",
      isBusy: true,
    };
  }

  if (
    session.filePath &&
    session.isDirty &&
    session.draftStatus === "saved"
  ) {
    return {
      state: "draft-saved",
      label: "Recovery draft saved",
      tooltip: "Recovery draft saved",
      icon: "file-clock",
      tone: "draft",
      isBusy: false,
    };
  }

  if (session.isDirty) {
    return {
      state: "edited",
      label: "Edited",
      tooltip: "Edited",
      icon: "pencil",
      tone: "edited",
      isBusy: false,
    };
  }

  if (session.filePath) {
    return {
      state: "file-saved",
      label: "Saved to file",
      tooltip: "Saved to file",
      icon: "file-check",
      tone: "saved",
      isBusy: false,
    };
  }

  return {
    state: "app-saved",
    label: "Saved",
    tooltip: "Saved",
    icon: "check",
    tone: "saved",
    isBusy: false,
  };
}
