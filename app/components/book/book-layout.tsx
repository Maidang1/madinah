import type { ReactNode } from 'react';
import type { BookSummaryInfo } from '~/types';

interface BookLayoutProps {
  book: BookSummaryInfo;
  sidebar: ReactNode;
  children: ReactNode;
  overview?: ReactNode;
}

export function BookLayout({
  book,
  sidebar,
  overview,
  children,
}: BookLayoutProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(260px,320px)_1fr]">
      <div className="space-y-6">
        {overview}
        {sidebar}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}
