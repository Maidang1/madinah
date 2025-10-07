import { redirect } from '@remix-run/cloudflare';
import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
// eslint-disable-next-line import/no-unresolved
import { getSerializedBook } from 'virtual:book-data';

export async function loader({ params }: LoaderFunctionArgs) {
  const { bookId } = params;
  if (!bookId) {
    throw new Response('Book not found', { status: 404 });
  }

  const book = getSerializedBook(bookId);
  if (!book) {
    throw new Response('Book not found', { status: 404 });
  }

  const chapterId = book.defaultChapterId ?? book.chapters[0]?.id ?? null;
  if (!chapterId) {
    throw new Response('No chapters available', { status: 404 });
  }

  throw redirect(`/books/${bookId}/${chapterId}`);
}

export default function BookIndexPlaceholder() {
  return null;
}
