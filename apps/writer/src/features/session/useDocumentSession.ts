import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  createEmptyDocument,
  parseMdxDocument,
  serializeMdxDocument,
  type DocumentMetadataPatch,
  type MarkdownDocument,
} from "../../domain/document";
import type { WorkspaceInfo, WriterPlugin } from "../../domain/engine";
import type { PlatformAdapters } from "../../platform/ports";
import { loadTrustedWorkspacePlugins } from "../engine/workspace-loader";
import {
  createDocumentSession,
  documentSessionReducer,
} from "./document-session";

const LOCAL_WORKSPACE: WorkspaceInfo = {
  root: "browser://local-documents",
  profile: "gfm",
  plugins: [],
};

export function useDocumentSession(
  platform: PlatformAdapters,
  activateWorkspacePlugins?: (
    workspace: WorkspaceInfo,
    plugins: WriterPlugin[],
  ) => Promise<void>,
) {
  const [session, dispatch] = useReducer(
    documentSessionReducer,
    undefined,
    createDocumentSession,
  );
  const [documents, setDocuments] = useState<MarkdownDocument[]>([]);
  const [status, setStatus] = useState("Loading");
  const saveTokenRef = useRef(0);

  const upsertDocument = useCallback((document: MarkdownDocument) => {
    setDocuments((current) =>
      sortDocuments(
        current.some((item) => item.id === document.id)
          ? current.map((item) => (item.id === document.id ? document : item))
          : [...current, document],
      ),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    platform.documentStore
      .list()
      .then(async (items) => {
        if (cancelled) return;
        const sortedItems = sortDocuments(items);
        const document =
          sortedItems[0] ??
          (await platform.documentStore.save(createEmptyDocument()));
        if (cancelled) return;

        setDocuments(sortedItems.length > 0 ? sortedItems : [document]);
        dispatch({
          type: "openSucceeded",
          document,
          workspace: LOCAL_WORKSPACE,
        });
        setStatus("Ready");
      })
      .catch((error: unknown) => setStatus(String(error)));

    return () => {
      cancelled = true;
    };
  }, [platform]);

  useEffect(() => {
    if (!session.document || !session.isDirty) return;

    const snapshot = session.document;
    const token = saveTokenRef.current + 1;
    saveTokenRef.current = token;
    dispatch({ type: "saveStarted" });
    setStatus("Saving");

    const timeout = window.setTimeout(() => {
      const saveTask = session.filePath
        ? platform.draftStore
            .write(session.filePath, snapshot.body)
            .then((draft) => {
              dispatch({ type: "draftSaved", draftPath: draft.path });
              return snapshot;
            })
        : platform.documentStore.save(snapshot);

      void saveTask
        .then((saved) => {
          if (saveTokenRef.current === token) {
            if (!session.filePath) {
              dispatch({ type: "saveSucceeded", document: saved });
              upsertDocument(saved);
              setStatus("Saved");
            } else {
              setStatus("Draft saved");
            }
          }
        })
        .catch((error: unknown) => {
          const message = String(error);
          dispatch({ type: "saveFailed", error: message });
          setStatus(message);
        });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [
    platform,
    session.document,
    session.filePath,
    session.isDirty,
    upsertDocument,
  ]);

  const changeSource = useCallback((source: string) => {
    dispatch({
      type: "changeSource",
      source,
      timestamp: new Date().toISOString(),
    });
    setStatus("Unsaved changes");
  }, []);

  const changeMetadata = useCallback((patch: DocumentMetadataPatch) => {
    dispatch({
      type: "changeMetadata",
      patch,
      timestamp: new Date().toISOString(),
    });
    setStatus("Unsaved changes");
  }, []);

  const restoreDocument = useCallback((document: MarkdownDocument) => {
    dispatch({
      type: "restoreDocument",
      document,
      timestamp: new Date().toISOString(),
    });
    setStatus("Version restored");
  }, []);

  const openMarkdownPath = useCallback(
    async (path: string) => {
      try {
        setStatus("Opening");
        const [file, workspacePlugins] = await Promise.all([
          platform.fileStore.readMarkdownFile(path),
          loadTrustedWorkspacePlugins(
            path,
            platform.pluginResolver,
            undefined,
            {
              confirmTrust: (plugin) =>
                platform.windowAdapter.confirm(
                  `Enable workspace plugin ${plugin.packageId}@${plugin.version}?`,
                  { title: "Trust workspace plugin" },
                ),
            },
          ),
        ]);

        await activateWorkspacePlugins?.(
          workspacePlugins.workspace,
          workspacePlugins.plugins,
        );
        await platform.recentStore.add(path);

        dispatch({
          type: "openSucceeded",
          document: parseMdxDocument(file.source, {
            slug: slugFromPath(path),
          }),
          workspace: workspacePlugins.workspace,
          filePath: path,
        });
        setStatus("Ready");
      } catch (error: unknown) {
        setStatus(String(error));
      }
    },
    [activateWorkspacePlugins, platform],
  );

  const openFromDialog = useCallback(async () => {
    const path = await platform.windowAdapter.openMarkdownFile({
      title: "Open Markdown file",
    });
    if (path) {
      await openMarkdownPath(path);
    }
  }, [openMarkdownPath, platform]);

  const saveNow = useCallback(async () => {
    if (!session.document) return;

    try {
      setStatus("Saving");
      if (session.filePath) {
        await platform.fileStore.writeMarkdownFile(
          session.filePath,
          serializeMdxDocument(session.document),
        );
        dispatch({ type: "saveSucceeded", document: session.document });
      } else {
        const saved = await platform.documentStore.save(session.document);
        dispatch({ type: "saveSucceeded", document: saved });
        upsertDocument(saved);
      }
      setStatus("Saved");
    } catch (error: unknown) {
      const message = String(error);
      dispatch({ type: "saveFailed", error: message });
      setStatus(message);
    }
  }, [platform, session.document, session.filePath, upsertDocument]);

  const openStoredDocument = useCallback(
    async (id: string) => {
      try {
        if (session.document?.id === id) return;
        if (session.isDirty) {
          await saveNow();
        }

        setStatus("Opening");
        const document = await platform.documentStore.get(id);
        dispatch({
          type: "openSucceeded",
          document,
          workspace: LOCAL_WORKSPACE,
        });
        setStatus("Ready");
      } catch (error: unknown) {
        setStatus(String(error));
      }
    },
    [platform, saveNow, session.document?.id, session.isDirty],
  );

  const createNewDocument = useCallback(async () => {
    try {
      if (session.isDirty) {
        await saveNow();
      }

      setStatus("Creating");
      const document = await platform.documentStore.save(createEmptyDocument());
      upsertDocument(document);
      dispatch({
        type: "openSucceeded",
        document,
        workspace: LOCAL_WORKSPACE,
      });
      setStatus("Ready");
    } catch (error: unknown) {
      setStatus(String(error));
    }
  }, [platform, saveNow, session.isDirty, upsertDocument]);

  const saveAs = useCallback(async () => {
    if (!session.document) return;

    const path = await platform.windowAdapter.saveMarkdownFile({
      title: "Save Markdown file",
      defaultPath: session.filePath ?? `${session.document.slug}.md`,
    });
    if (!path) return;

    try {
      setStatus("Saving");
      await platform.fileStore.writeMarkdownFile(
        path,
        serializeMdxDocument(session.document),
      );
      await platform.recentStore.add(path);
      dispatch({
        type: "saveAsSucceeded",
        document: session.document,
        filePath: path,
      });
      setStatus("Saved");
    } catch (error: unknown) {
      const message = String(error);
      dispatch({ type: "saveFailed", error: message });
      setStatus(message);
    }
  }, [platform, session.document, session.filePath]);

  const revert = useCallback(() => {
    dispatch({ type: "revert" });
    setStatus("Reverted");
  }, []);

  const close = useCallback(async () => {
    if (!session.document) return;

    if (session.isDirty) {
      dispatch({ type: "closeRequested" });
      const shouldClose = await platform.windowAdapter.confirm(
        "Close this document and discard unsaved changes?",
        { title: "Close document" },
      );
      if (!shouldClose) return;
    }

    dispatch({ type: "closeConfirmed" });
    setStatus("Closed");
  }, [platform, session.document, session.isDirty]);

  return {
    session,
    documents,
    status,
    changeSource,
    changeMetadata,
    restoreDocument,
    openFromDialog,
    openStoredDocument,
    createNewDocument,
    openMarkdownPath,
    saveNow,
    saveAs,
    revert,
    close,
    setStatus,
    dispatch,
  };
}

function sortDocuments<T extends { updatedAt: string }>(documents: T[]): T[] {
  return [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function slugFromPath(path: string): string {
  const fileName = path.split(/[\\/]/).pop() ?? "untitled";
  return fileName.replace(/\.(md|mdx|markdown)$/i, "") || "untitled";
}
