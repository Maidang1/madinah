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
  if (window.madinahWriter) {
    return window.madinahWriter.documents.list();
  }

  return listBrowserDocuments();
}

export async function getDocument(id: string): Promise<WriterDocument> {
  if (window.madinahWriter) {
    return window.madinahWriter.documents.get(id);
  }

  const document = (await listBrowserDocuments()).find(
    (item) => item.id === id,
  );
  if (!document) throw new Error(`Document ${id} not found`);
  return document;
}

export async function saveDocument(document: WriterDocument): Promise<WriterDocument> {
  if (window.madinahWriter) {
    return window.madinahWriter.documents.save(document);
  }

  return saveBrowserDocument(document);
}

export async function deleteDocument(id: string): Promise<void> {
  if (window.madinahWriter) {
    await window.madinahWriter.documents.delete(id);
    return;
  }

  saveBrowserDocuments(
    (await listBrowserDocuments()).filter((document) => document.id !== id),
  );
}

export async function chooseBlogDirectory(): Promise<string | null> {
  if (window.madinahWriter) {
    return window.madinahWriter.dialog.openDirectory({
      title: "Select blog repository or src/blogs directory",
    });
  }

  return null;
}

export async function importBlogDirectory(path: string): Promise<WriterDocument[]> {
  if (!window.madinahWriter) {
    return [];
  }

  const files = await window.madinahWriter.blog.importDirectory(path);
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
  if (!window.madinahWriter) {
    return { path: `${blogDir}/${document.slug}.mdx` };
  }

  const slug = document.slug.trim();
  const source = serializeMdxDocument(document);

  try {
    return await window.madinahWriter.blog.exportDocument({
      blogDir,
      slug,
      source,
      overwrite: false,
    });
  } catch (error) {
    const message = String(error);

    if (!message.includes("already exists")) {
      throw error;
    }

    const shouldOverwrite = await window.madinahWriter.dialog.confirm(
      `${slug}.mdx already exists. Overwrite it?`,
      { title: "Export article" },
    );

    if (!shouldOverwrite) {
      throw error;
    }

    return window.madinahWriter.blog.exportDocument({
      blogDir,
      slug,
      source,
      overwrite: true,
    });
  }
}

const BROWSER_DOCUMENTS_KEY = "madinah-writer-documents";

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
