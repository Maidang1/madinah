import { json } from '@remix-run/cloudflare';
import type { MetaFunction } from '@remix-run/cloudflare';
import {
  Link,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from '@remix-run/react';
import { BookList } from '~/features/books/components/book-list';
import { ErrorState } from '~/core/ui/common/error-state';
import { jsonError } from '~/core/utils';
import { DEFAULT_LOCALE, translations } from '~/core/i18n';
import type { BookSummaryInfo } from '~/types';
// eslint-disable-next-line import/no-unresolved
import { getBooks } from 'virtual:book-data';
import { useTranslation } from '~/core/i18n';

export async function loader() {
  try {
    const books = getBooks();
    if (!Array.isArray(books)) {
      throw new Error('Books data must be an array');
    }
    return json({ books: books as BookSummaryInfo[] });
  } catch (error) {
    console.error('Failed to load books', error);
    throw jsonError('Failed to load books', { status: 500 });
  }
}

export const meta: MetaFunction = () => [
  {
    title:
      translations[DEFAULT_LOCALE]?.books?.meta?.title ?? 'Books • Madinah',
  },
  {
    name: 'description',
    content:
      translations[DEFAULT_LOCALE]?.books?.meta?.description ??
      '系统化地阅读 Rust、Remix 等专题整理的书籍系列。',
  },
];

export default function BooksIndexRoute() {
  const { books } = useLoaderData<typeof loader>();
  const { t } = useTranslation();

  const sortedBooks = [...books].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <h1 className="text-foreground text-3xl font-bold">
          {t('books.list.heading')}
        </h1>
      </header>
      <BookList books={sortedBooks} />
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const { t } = useTranslation();

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorState
        title={t('books.errors.listLoadTitle')}
        message={
          typeof error.data === 'string'
            ? error.data
            : (error.data?.error ?? error.statusText)
        }
        action={
          <Link
            to="/"
            className="bg-gray-700 hover:bg-gray-800 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white transition"
          >
            {t('books.errors.goHome')}
          </Link>
        }
      />
    );
  }

  return (
    <ErrorState
      title={t('books.errors.listRenderTitle')}
      message={
        error instanceof Error
          ? error.message
          : t('books.errors.listRenderMessage')
      }
      action={
        <Link
          to="/"
          className="bg-gray-700 hover:bg-gray-900 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white transition"
        >
          {t('books.errors.goHome')}
        </Link>
      }
    />
  );
}
