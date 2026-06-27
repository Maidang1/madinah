import { invoke } from "@tauri-apps/api/core";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import {
  parseMdxDocument,
  serializeMdxDocument,
  type WriterDocument,
} from "./content";

export interface ImportedBlogFile {
  slug: string;
  path: string;
  source: string;
}

export interface ExportResult {
  path: string;
}

export async function listDocuments(): Promise<WriterDocument[]> {
  if (!isTauriRuntime()) {
    return listBrowserDocuments();
  }

  return invoke<WriterDocument[]>("list_documents");
}

export async function getDocument(id: string): Promise<WriterDocument> {
  if (!isTauriRuntime()) {
    const document = (await listBrowserDocuments()).find(
      (item) => item.id === id,
    );
    if (!document) throw new Error(`Document ${id} not found`);
    return document;
  }

  return invoke<WriterDocument>("get_document", { id });
}

export async function saveDocument(document: WriterDocument): Promise<WriterDocument> {
  if (!isTauriRuntime()) {
    return saveBrowserDocument(document);
  }

  return invoke<WriterDocument>("save_document", { document });
}

export async function deleteDocument(id: string): Promise<void> {
  if (!isTauriRuntime()) {
    saveBrowserDocuments(
      (await listBrowserDocuments()).filter((document) => document.id !== id),
    );
    return;
  }

  await invoke("delete_document", { id });
}

export async function chooseBlogDirectory(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select blog repository or src/blogs directory",
  });

  return typeof selected === "string" ? selected : null;
}

export async function importBlogDirectory(path: string): Promise<WriterDocument[]> {
  if (!isTauriRuntime()) {
    return [];
  }

  const files = await invoke<ImportedBlogFile[]>("import_blog_dir", { path });
  const timestamp = new Date().toISOString();

  return files.map((file) =>
    parseMdxDocument(file.source, {
      slug: file.slug,
      createdAt: timestamp,
      updatedAt: timestamp,
    }),
  );
}

export async function exportDocumentToBlog(
  blogDir: string,
  document: WriterDocument,
): Promise<ExportResult> {
  if (!isTauriRuntime()) {
    return { path: `${blogDir}/${document.slug}.mdx` };
  }

  const slug = document.slug.trim();
  const source = serializeMdxDocument(document);

  try {
    return await invoke<ExportResult>("export_document_to_blog", {
      input: { blogDir, slug, source, overwrite: false },
    });
  } catch (error) {
    const message = String(error);

    if (!message.includes("already exists")) {
      throw error;
    }

    const shouldOverwrite = await confirm(
      `${slug}.mdx already exists. Overwrite it?`,
      { title: "Export article", kind: "warning" },
    );

    if (!shouldOverwrite) {
      throw error;
    }

    return invoke<ExportResult>("export_document_to_blog", {
      input: { blogDir, slug, source, overwrite: true },
    });
  }
}

const BROWSER_DOCUMENTS_KEY = "madinah-writer-documents";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function listBrowserDocuments(): Promise<WriterDocument[]> {
  const raw = window.localStorage.getItem(BROWSER_DOCUMENTS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveBrowserDocument(
  document: WriterDocument,
): Promise<WriterDocument> {
  const documents = await listBrowserDocuments();
  const saved = {
    ...document,
    updatedAt: new Date().toISOString(),
  };
  const nextDocuments = documents.some((item) => item.id === saved.id)
    ? documents.map((item) => (item.id === saved.id ? saved : item))
    : [...documents, saved];

  saveBrowserDocuments(nextDocuments);
  return saved;
}

function saveBrowserDocuments(documents: WriterDocument[]) {
  window.localStorage.setItem(BROWSER_DOCUMENTS_KEY, JSON.stringify(documents));
}
