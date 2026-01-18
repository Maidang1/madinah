import type { ReactNode } from 'react';
import { MDXWrapper } from '~/core/mdx/mdx-wrapper';
import { LicenseNotice } from '~/core/ui/common/license-notice';
import type { BookChapterInfo, BookSummaryInfo } from '~/types';

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
    <article className="border-border-weak/60 bg-surface-raised-base/80 dark:bg-surface-raised-base/60 min-w-0 rounded-2xl border p-8 shadow-sm backdrop-blur">
      <header className="mb-10 space-y-4">
        <p className="text-xs font-semibold tracking-wide text-gray-700 uppercase">
          {book.title}
        </p>
        <h1 className="text-text-strong text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {chapter.title}
        </h1>
        {chapter.summary ? (
          <div className="text-text-weak relative overflow-hidden rounded-xl border border-gray-700/50 p-5 text-sm leading-relaxed">
            {chapter.summary}
          </div>
        ) : null}
      </header>

      <MDXWrapper className="mt-8 px-0 sm:px-0 lg:px-0">{children}</MDXWrapper>
      <LicenseNotice />
    </article>
  );
}
