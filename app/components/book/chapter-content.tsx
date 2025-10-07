import type { ReactNode } from 'react';
import type { BookChapterInfo, BookSummaryInfo } from '~/types';
import { LicenseNotice } from '../blog-detail/license-notice';

interface BookChapterContentProps {
  book: BookSummaryInfo;
  chapter: BookChapterInfo;
  children: ReactNode;
}

export function BookChapterContent({
  book,
  chapter,
  children,
}: BookChapterContentProps) {
  return (
    <article className="prose prose-neutral border-border/60 bg-background/80 dark:prose-invert dark:bg-background/60 max-w-none rounded-2xl border p-8 shadow-sm transition">
      <header className="mb-8 flex flex-col gap-2">
        <p className="text-main-500 text-xs font-medium tracking-wide uppercase">
          {book.title}
        </p>
        <h1 className="text-foreground text-3xl font-bold">{chapter.title}</h1>
        {chapter.summary ? (
          <p className="text-muted-foreground text-sm">{chapter.summary}</p>
        ) : null}
      </header>
      <div>{children}</div>
      <LicenseNotice />
    </article>
  );
}
