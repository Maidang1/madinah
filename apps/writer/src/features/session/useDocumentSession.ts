import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  createEmptyDocument,
  parseMdxDocument,
  serializeMdxDocument,
  type DocumentStatus,
  type DocumentMetadataPatch,
  type MarkdownDocument,
} from "../../domain/document";
import {
  getDocumentSourceFilePath,
  isDraftDocumentSource,
} from "../../domain/document-source";
import type { WorkspaceInfo, WriterPlugin } from "../../domain/engine";
import type { BlogDocumentFile, PlatformAdapters } from "../../platform/ports";
import { loadTrustedWorkspacePlugins } from "../engine/workspace-loader";
import {
  createDocumentSession,
  documentSessionReducer,
} from "./document-session";
import { publishStoredDocumentToFile } from "./publish-document";

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

    const timeout = window.setTimeout(() => {
      setStatus("Saving");

      const filePath = getDocumentSourceFilePath(session.source);
      const saveTask = filePath
        ? platform.fileStore
            .writeMarkdownFile(filePath, serializeMdxDocument(snapshot))
            .then(() => snapshot)
        : platform.documentStore.save(snapshot);

      void saveTask
        .then((saved) => {
          if (saveTokenRef.current === token) {
            dispatch({
              type: "saveSucceeded",
              document: saved,
              savedFrom: snapshot,
            });
            if (!filePath) {
              upsertDocument(saved);
            }
            setStatus("Saved");
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
    session.source,
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

    const snapshot = session.document;
    try {
      setStatus("Saving");
      const filePath = getDocumentSourceFilePath(session.source);
      if (filePath) {
        await platform.fileStore.writeMarkdownFile(
          filePath,
          serializeMdxDocument(snapshot),
        );
        dispatch({
          type: "saveSucceeded",
          document: snapshot,
          savedFrom: snapshot,
        });
      } else {
        const saved = await platform.documentStore.save(snapshot);
        dispatch({ type: "saveSucceeded", document: saved, savedFrom: snapshot });
        upsertDocument(saved);
      }
      setStatus("Saved");
    } catch (error: unknown) {
      const message = String(error);
      dispatch({ type: "saveFailed", error: message });
      setStatus(message);
    }
  }, [platform, session.document, session.source, upsertDocument]);

  // Best-effort flush of unsaved changes when the window loses focus or is
  // about to close, so a crash / quit within the 500ms autosave debounce does
  // not drop the last edits. `saveNow` is a no-op when the session is clean.
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;
  const isDirtyRef = useRef(session.isDirty);
  isDirtyRef.current = session.isDirty;

  useEffect(() => {
    const flush = () => {
      if (isDirtyRef.current) {
        void saveNowRef.current();
      }
    };

    window.addEventListener("beforeunload", flush);
    window.addEventListener("blur", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.removeEventListener("blur", flush);
    };
  }, []);

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

  const importBlogDocuments = useCallback(
    async (files: BlogDocumentFile[]) => {
      if (files.length === 0) {
        setStatus("No blog posts found");
        return [];
      }

      try {
        if (session.isDirty) {
          await saveNow();
        }

        setStatus("Importing");
        const imported = await Promise.all(
          files.map((file) =>
            platform.documentStore.save(
              parseMdxDocument(file.source, {
                slug: file.slug,
              }),
            ),
          ),
        );

        setDocuments((current) => sortDocuments([...current, ...imported]));
        dispatch({
          type: "openSucceeded",
          document: imported[0],
          workspace: LOCAL_WORKSPACE,
        });
        setStatus(
          `Imported ${imported.length} blog ${imported.length === 1 ? "post" : "posts"}`,
        );
        return imported;
      } catch (error: unknown) {
        setStatus(String(error));
        return [];
      }
    },
    [platform.documentStore, saveNow, session.isDirty],
  );

  const publishStoredDocument = useCallback(
    async (id: string, filePath: string) => {
      try {
        setStatus("Publishing");
        if (
          session.isDirty &&
          (session.document?.id !== id || !isDraftDocumentSource(session.source))
        ) {
          await saveNow();
        }

        saveTokenRef.current += 1;
        const result = await publishStoredDocumentToFile({
          id,
          targetPath: filePath,
          activeDocument: session.document,
          activeFilePath: getDocumentSourceFilePath(session.source),
          documentStore: platform.documentStore,
          fileStore: platform.fileStore,
          recentStore: platform.recentStore,
        });

        setDocuments((current) =>
          sortDocuments(current.filter((document) => document.id !== id)),
        );
        await openMarkdownPath(result.filePath);
        setStatus("Published");
        return result;
      } catch (error: unknown) {
        setStatus(String(error));
        return null;
      }
    },
    [
      openMarkdownPath,
      platform.documentStore,
      platform.fileStore,
      platform.recentStore,
      saveNow,
      session.document,
      session.source,
      session.isDirty,
    ],
  );

  const updateStoredDocumentStatus = useCallback(
    async (id: string, documentStatus: DocumentStatus) => {
      try {
        setStatus("Updating");
        const current =
          session.document?.id === id && isDraftDocumentSource(session.source)
            ? session.document
            : await platform.documentStore.get(id);
        const updated: MarkdownDocument = {
          ...current,
          status: documentStatus,
          updatedAt: new Date().toISOString(),
        };
        const saved = await platform.documentStore.save(updated);
        upsertDocument(saved);

        if (session.document?.id === id && isDraftDocumentSource(session.source)) {
          dispatch({ type: "saveSucceeded", document: saved });
        }

        setStatus(statusLabelForDocumentStatus(documentStatus));
      } catch (error: unknown) {
        setStatus(String(error));
      }
    },
    [platform, session.document, session.source, upsertDocument],
  );

  const deleteStoredDocument = useCallback(
    async (id: string) => {
      try {
        setStatus("Deleting");
        saveTokenRef.current += 1;
        await platform.documentStore.delete(id);

        let nextDocuments = sortDocuments(
          documents.filter((document) => document.id !== id),
        );

        if (session.document?.id === id && isDraftDocumentSource(session.source)) {
          const nextDocument =
            nextDocuments[0] ??
            (await platform.documentStore.save(createEmptyDocument()));
          nextDocuments =
            nextDocuments.length > 0 ? nextDocuments : [nextDocument];
          dispatch({
            type: "openSucceeded",
            document: nextDocument,
            workspace: LOCAL_WORKSPACE,
          });
        }

        setDocuments(nextDocuments);
        setStatus("Deleted");
      } catch (error: unknown) {
        setStatus(String(error));
      }
    },
    [documents, platform, session.document?.id, session.source],
  );

  const revert = useCallback(() => {
    dispatch({ type: "revert" });
    setStatus("Reverted");
  }, []);

  const close = useCallback(async () => {
    if (!session.document) return;

    if (session.isDirty) {
      await saveNow();
    }

    dispatch({ type: "closeConfirmed" });
    setStatus("Closed");
  }, [saveNow, session.document, session.isDirty]);

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
    importBlogDocuments,
    publishStoredDocument,
    updateStoredDocumentStatus,
    deleteStoredDocument,
    saveNow,
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

function statusLabelForDocumentStatus(status: DocumentStatus): string {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  if (status === "WIP") return "Marked as WIP";
  return "Marked as draft";
}
