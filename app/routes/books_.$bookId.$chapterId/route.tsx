import { json } from '@remix-run/cloudflare';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/cloudflare';
import { Suspense, lazy, useMemo } from 'react';
import type { ComponentType } from 'react';
import { useLoaderData, useOutletContext } from '@remix-run/react';
import { BookChapterContent } from '~/components/book/chapter-content';
import type { BookChapterInfo, BookSummaryInfo } from '~/types';
import type { BookRouteContext } from '../books_.$bookId/route';
// eslint-disable-next-line import/no-unresolved
import { getSerializedChapter, loadChapterModule } from 'virtual:book-data';

interface LoaderData {
  chapter: BookChapterInfo;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const { bookId, chapterId } = params;
  if (!bookId || !chapterId) {
    throw new Response('Chapter not found', { status: 404 });
  }

  const chapter = getSerializedChapter(bookId, chapterId);
  if (!chapter) {
    throw new Response('Chapter not found', { status: 404 });
  }

  return json<LoaderData>({ chapter });
}

export const meta: MetaFunction<typeof loader> = ({
  data,
  params,
  matches,
}) => {
  if (!data) {
    return [];
  }
  const parent = matches?.find((match) =>
    match.id.endsWith('books_.$bookId/route'),
  )?.data as { book: BookSummaryInfo } | undefined;
  const bookTitle = parent?.book.title ?? params.bookId ?? 'Books';
  return [
    { title: `${data.chapter.title} • ${bookTitle} • Madinah` },
    {
      name: 'description',
      content:
        data.chapter.summary ??
        `阅读 ${bookTitle} 的章节 ${data.chapter.title}`,
    },
  ];
};

export default function BookChapterRoute() {
  const { chapter } = useLoaderData<typeof loader>();
  const { book } = useOutletContext<BookRouteContext>();

  const ChapterComponent = useMemo(
    () =>
      lazy(async () => {
        const result = await loadChapterModule(book.id, chapter.id);
        const Fallback: ComponentType = () => null;
        return { default: (result?.module as ComponentType) ?? Fallback };
      }),
    [book.id, chapter.id],
  );

  return (
    <Suspense
      key={chapter.id}
      fallback={
        <div className="border-border/60 bg-background/40 text-muted-foreground rounded-2xl border p-8 text-sm">
          正在加载章节内容...
        </div>
      }
    >
      <BookChapterContent book={book} chapter={chapter}>
        <ChapterComponent />
      </BookChapterContent>
    </Suspense>
  );
}
