import { json } from '@remix-run/cloudflare';
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { Outlet, useLoaderData } from '@remix-run/react';
import { BookChapterSidebar } from '~/components/book/chapter-sidebar';
import { BookLayout } from '~/components/book/book-layout';
import { BookOverviewCard } from '~/components/book/book-overview-card';
import type { BookSummaryInfo } from '~/types';
// eslint-disable-next-line import/no-unresolved
import { getSerializedBook } from 'virtual:book-data';

interface LoaderData {
  book: BookSummaryInfo;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const { bookId } = params;
  if (!bookId) {
    throw new Response('Book not found', { status: 404 });
  }

  const book = getSerializedBook(bookId);
  if (!book) {
    throw new Response('Book not found', { status: 404 });
  }

  return json<LoaderData>({ book });
}

export type BookRouteContext = LoaderData;

export default function BookRoute() {
  const { book } = useLoaderData<typeof loader>();

  return (
    <BookLayout
      book={book}
      overview={<BookOverviewCard book={book} />}
      sidebar={<BookChapterSidebar book={book} />}
    >
      <Outlet context={{ book }} />
    </BookLayout>
  );
}
