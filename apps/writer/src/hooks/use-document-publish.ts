import { useCallback, useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  PUBLISHED_BLOG_POST_STATUS,
  getBlogPostStatus,
  getBlogPostUrl,
  isBlogPostContentPath,
  prepareBlogPostForPublish,
} from "@madinah/content-core";
import { flushSave } from "@/lib/save";
import * as tauri from "@/lib/tauri";
import { useEditorStore } from "@/stores/editor-store";

type PublishState =
  | { status: "idle" }
  | { status: "running"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function useDocumentPublish(filePath: string) {
  const frontmatter = useEditorStore((state) => state.openFiles.get(filePath)?.frontmatter ?? null);
  const body = useEditorStore((state) => state.openFiles.get(filePath)?.content ?? "");
  const updateFrontmatter = useEditorStore((state) => state.updateFrontmatter);
  const [state, setState] = useState<PublishState>({ status: "idle" });
  const publishedSnapshotRef = useRef<string | null>(null);
  const snapshot = `${frontmatter ?? ""}\u0000${body}`;

  useEffect(() => {
    if (state.status !== "success") return;
    if (publishedSnapshotRef.current === snapshot) return;
    publishedSnapshotRef.current = null;
    setState({ status: "idle" });
  }, [snapshot, state.status]);

  const publish = useCallback(async () => {
    if (state.status === "running") return;
    setState({ status: "running", message: "Preparing article…" });

    try {
      const prepared = prepareBlogPostForPublish({ filePath, frontmatter, body });
      updateFrontmatter(filePath, prepared.frontmatter);
      setState({ status: "running", message: "Saving and publishing…" });
      await flushSave(filePath);
      const result = await tauri.publishDocument(filePath);

      publishedSnapshotRef.current = `${prepared.frontmatter}\u0000${body}`;
      setState({
        status: "success",
        message:
          result.status === "published"
            ? `Published ${result.commit.slice(0, 7)} to ${result.upstream}.`
            : `${result.upstream} is already up to date.`,
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [body, filePath, frontmatter, state.status, updateFrontmatter]);

  const openOnline = useCallback(async () => {
    try {
      await openUrl(getBlogPostUrl(filePath));
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [filePath]);

  return {
    ...state,
    isAvailable: isBlogPostContentPath(filePath),
    isPublished: getBlogPostStatus(frontmatter) === PUBLISHED_BLOG_POST_STATUS,
    publish,
    openOnline,
  };
}
