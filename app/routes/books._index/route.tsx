import { json } from '@remix-run/cloudflare';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { BookList } from '~/components/book/book-list';
import type { BookSummaryInfo } from '~/types';
// eslint-disable-next-line import/no-unresolved
import { getBooks } from 'virtual:book-data';

export async function loader(_args: LoaderFunctionArgs) {
  const books = getBooks() as BookSummaryInfo[];
  return json({ books });
}

export const meta: MetaFunction = () => [
  { title: 'Books • Madinah' },
  {
    name: 'description',
    content: '系统化地阅读 Rust、Remix 等专题整理的书籍系列。',
  },
];

export default function BooksIndexRoute() {
  const { books } = useLoaderData<typeof loader>();
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-main-500 text-sm tracking-wide uppercase">
          精选阅读
        </p>
        <h1 className="text-foreground text-3xl font-bold">Books</h1>
        <p className="text-muted-foreground text-sm">
          聚合长期整理的系列文章，按照章节阅读，更体系化地学习。
        </p>
      </header>
      <BookList books={books} />
    </div>
  );
}
