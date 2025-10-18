import { promises as fs, Dirent } from 'fs';
import path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdx from 'remark-mdx';
import { matter } from 'vfile-matter';
import type { Plugin } from 'vite';

const rootDir = process.cwd();
const booksDir = path.join(rootDir, 'app', 'features', 'books', 'content');
const booksAppPath = path.posix.join('app', 'features', 'books', 'content');

interface BookChapterMeta {
  id: string;
  title: string;
  order: number;
  summary: string;
  importer: string;
}

interface BookBuildMeta {
  id: string;
  title: string;
  description: string;
  author: string;
  coverImage: string | null;
  tags: string[];
  defaultChapterId: string | null;
  directoryName: string;
  overviewImporter: string | null;
  chapters: BookChapterMeta[];
}

function humanizeSlug(value: string) {
  return value
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function readMdxFrontmatter(filePath: string) {
  const rawContent = await fs.readFile(filePath, 'utf-8');
  const processed = await unified()
    .use(remarkMdx)
    .use(remarkParse)
    .use(remarkStringify)
    .use(remarkFrontmatter)
    .use(() => (_tree: unknown, file: any) => {
      matter(file);
    })
    .process(rawContent);

  const frontmatter = (processed.data as { matter?: Record<string, unknown> })?.matter ?? {};
  const content = String(processed).replace(/^---[\s\S]*?---/, '').trim();
  return { frontmatter, content };
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/--+/g, '-');
}

function deriveChapterSummary(content: string) {
  if (!content) return '';
  const text = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[#>*`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 200).trim();
}

function buildImportSpecifier(directoryName: string, ...segments: string[]) {
  return `/${path.posix.join(booksAppPath, directoryName, ...segments)}`;
}

function buildRuntimeChapter(chapter: BookChapterMeta) {
  return `{
    id: ${JSON.stringify(chapter.id)},
    title: ${JSON.stringify(chapter.title)},
    order: ${chapter.order},
    summary: ${JSON.stringify(chapter.summary)},
    load: async () => {
      const mod = await import(${JSON.stringify(chapter.importer)});
      return {
        module: mod.default,
        frontmatter: mod.frontmatter ?? mod.attributes ?? mod.metadata ?? null,
      };
    }
  }`;
}

function buildRuntimeBook(book: BookBuildMeta) {
  const chaptersCode = book.chapters.map(buildRuntimeChapter).join(',\n');

  return `{
    id: ${JSON.stringify(book.id)},
    title: ${JSON.stringify(book.title)},
    description: ${JSON.stringify(book.description)},
    author: ${JSON.stringify(book.author)},
    coverImage: ${JSON.stringify(book.coverImage)},
    tags: ${JSON.stringify(book.tags)},
    defaultChapterId: ${book.defaultChapterId ? JSON.stringify(book.defaultChapterId) : 'null'},
    directoryName: ${JSON.stringify(book.directoryName)},
    loadOverview: ${book.overviewImporter ? `async () => {
      const mod = await import(${JSON.stringify(book.overviewImporter)});
      return {
        module: mod.default,
        frontmatter: mod.frontmatter ?? mod.attributes ?? mod.metadata ?? null,
      };
    }` : 'null'},
    chapters: [${chaptersCode}]
  }`;
}

function buildModuleCode(books: BookBuildMeta[]) {
  const runtimeBooksCode = books.map(buildRuntimeBook).join(',\n');

  return `const runtimeBooks = [${runtimeBooksCode}];

const books = runtimeBooks
  .map((book) => {
    const chapters = [...book.chapters].sort((a, b) => {
      if (a.order === b.order) {
        return a.title.localeCompare(b.title, 'en');
      }
      return a.order - b.order;
    });

    const chapterMap = Object.fromEntries(chapters.map((chapter) => [chapter.id, chapter]));

    return {
      ...book,
      chapters,
      chapterMap,
    };
  });

const bookMap = Object.fromEntries(books.map((book) => [book.id, book]));

export const booksRuntime = books;

export const booksSerialized = books.map((book) => ({
  id: book.id,
  title: book.title,
  description: book.description,
  author: book.author,
  coverImage: book.coverImage,
  tags: book.tags,
  defaultChapterId: book.defaultChapterId,
  hasOverview: Boolean(book.loadOverview),
  chapterCount: book.chapters.length,
  chapters: book.chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    order: chapter.order,
    summary: chapter.summary,
  })),
}));

export function getBooks() {
  return booksSerialized;
}

export function getBook(bookId) {
  return bookMap[bookId] ?? null;
}

export function getSerializedBook(bookId) {
  return booksSerialized.find((book) => book.id === bookId) ?? null;
}

export function getChapter(bookId, chapterId) {
  const book = getBook(bookId);
  if (!book) {
    return null;
  }
  return book.chapterMap?.[chapterId] ?? null;
}

export function getSerializedChapter(bookId, chapterId) {
  const book = getSerializedBook(bookId);
  if (!book) {
    return null;
  }
  return book.chapters.find((chapter) => chapter.id === chapterId) ?? null;
}

export async function loadChapterModule(bookId, chapterId) {
  const book = getBook(bookId);
  if (!book) {
    return null;
  }
  const chapter = book.chapterMap[chapterId];
  if (!chapter) {
    return null;
  }
  return chapter.load();
}

export async function loadBookOverview(bookId) {
  const book = getBook(bookId);
  if (!book?.loadOverview) {
    return null;
  }
  return book.loadOverview();
}

export default booksSerialized;
`;
}

async function collectBooks(): Promise<BookBuildMeta[]> {
  let directories: Dirent[];
  try {
    directories = await fs.readdir(booksDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const books: BookBuildMeta[] = [];

  for (const entry of directories) {
    if (!entry.isDirectory()) {
      continue;
    }

    const directoryName = entry.name;
    const bookEntryPath = path.join(booksDir, directoryName, 'book.mdx');

    try {
      await fs.access(bookEntryPath);
    } catch {
      continue;
    }

    const { frontmatter: bookFrontmatter, content: bookContent } = await readMdxFrontmatter(bookEntryPath);
    const bookId = (typeof bookFrontmatter.id === 'string' && bookFrontmatter.id.trim())
      ? toSlug(bookFrontmatter.id.trim())
      : toSlug(directoryName);

    const title = typeof bookFrontmatter.title === 'string' && bookFrontmatter.title.trim()
      ? bookFrontmatter.title.trim()
      : humanizeSlug(directoryName);

    const description = typeof bookFrontmatter.description === 'string'
      ? bookFrontmatter.description.trim()
      : deriveChapterSummary(bookContent);

    const author = typeof bookFrontmatter.author === 'string' ? bookFrontmatter.author.trim() : '';
    const coverImage = typeof bookFrontmatter.coverImage === 'string' ? bookFrontmatter.coverImage.trim() : null;
    const tags = Array.isArray(bookFrontmatter.tags) ? bookFrontmatter.tags.filter((tag): tag is string => typeof tag === 'string') : [];

    const chaptersDirectory = path.join(booksDir, directoryName, 'chapters');

    let chapterEntries: Dirent[];
    try {
      chapterEntries = await fs.readdir(chaptersDirectory, { withFileTypes: true });
    } catch {
      chapterEntries = [];
    }

    const chapters: BookChapterMeta[] = [];

    for (const chapterEntry of chapterEntries) {
      if (!chapterEntry.isFile() || !chapterEntry.name.endsWith('.mdx')) {
        continue;
      }

      const chapterPath = path.join(chaptersDirectory, chapterEntry.name);
      const { frontmatter: chapterFrontmatter, content: chapterContent } = await readMdxFrontmatter(chapterPath);
      const baseName = chapterEntry.name.replace(/\.mdx$/, '');

      const chapterSlugRaw = typeof chapterFrontmatter.slug === 'string' && chapterFrontmatter.slug.trim()
        ? chapterFrontmatter.slug.trim()
        : baseName.replace(/^\d+[-_]?/, '');

      const chapterId = toSlug(chapterSlugRaw);
      const titleRaw = typeof chapterFrontmatter.title === 'string' && chapterFrontmatter.title.trim()
        ? chapterFrontmatter.title.trim()
        : humanizeSlug(chapterSlugRaw);

      const order = typeof chapterFrontmatter.order === 'number'
        ? chapterFrontmatter.order
        : parseInt(baseName.match(/^\d+/)?.[0] ?? '999', 10);

      const summaryRaw = typeof chapterFrontmatter.summary === 'string'
        ? chapterFrontmatter.summary.trim()
        : deriveChapterSummary(chapterContent);

      const importer = buildImportSpecifier(directoryName, 'chapters', chapterEntry.name);

      chapters.push({
        id: chapterId,
        title: titleRaw,
        order: Number.isFinite(order) ? order : 999,
        summary: summaryRaw,
        importer,
      });
    }

    if (!chapters.length) {
      continue;
    }

    chapters.sort((a, b) => {
      if (a.order === b.order) {
        return a.title.localeCompare(b.title, 'en');
      }
      return a.order - b.order;
    });

    const defaultChapterId = typeof bookFrontmatter.defaultChapter === 'string'
      ? toSlug(bookFrontmatter.defaultChapter)
      : chapters[0]?.id ?? null;

    books.push({
      id: bookId,
      title,
      description,
      author,
      coverImage,
      tags,
      defaultChapterId,
      directoryName,
      overviewImporter: buildImportSpecifier(directoryName, 'book.mdx'),
      chapters,
    });
  }

  return books;
}

export async function generateBooksModule() {
  const books = await collectBooks();
  return buildModuleCode(books);
}

export function booksVirtualPlugin(): Plugin {
  const virtualModuleId = 'virtual:book-data';
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;
  let moduleCodePromise: Promise<string> | null = null;

  const ensureModuleCode = () => {
    if (!moduleCodePromise) {
      moduleCodePromise = generateBooksModule().catch((error) => {
        moduleCodePromise = null;
        throw error;
      });
    }
    return moduleCodePromise;
  };

  return {
    name: 'book-virtual-module',
    async buildStart() {
      try {
        await fs.stat(booksDir);
        this.addWatchFile(booksDir);
      } catch {
        // directory might not exist yet; ignore
      }
      await ensureModuleCode();
    },
    resolveId(id) {
      if (id === virtualModuleId) {
        return resolvedVirtualModuleId;
      }
      return null;
    },
    async load(id) {
      if (id === resolvedVirtualModuleId) {
        return ensureModuleCode();
      }
      return null;
    },
    configureServer(server) {
      server.watcher.add(booksDir);
    },
    async handleHotUpdate(context) {
      if (context.file.startsWith(booksDir)) {
        moduleCodePromise = null;
        const mod = context.server.moduleGraph.getModuleById(resolvedVirtualModuleId);
        if (mod) {
          return [mod];
        }
      }
      return undefined;
    },
  };
}
