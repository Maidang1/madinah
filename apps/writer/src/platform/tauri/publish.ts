import { invoke } from "@tauri-apps/api/core";

export interface PublishResult {
  status: "published" | "unchanged";
  commit: string;
  branch: string;
  upstream: string;
}

export function publishDocument(filePath: string): Promise<PublishResult> {
  return invoke("publish_document", { filePath });
}
