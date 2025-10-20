import { Outlet } from '@remix-run/react';
import { motion } from 'motion/react';
import type { ReadTimeResults } from 'reading-time';
import { forwardRef, useMemo } from 'react';
import { CalendarDays, Clock, FileText, PencilLine, Tag, UserRound } from 'lucide-react';
import { MDXWrapper } from '~/core/mdx/mdx-wrapper';
import { LicenseNotice } from '~/core/ui/common/license-notice';
import { cn } from '~/core/utils';

interface BlogContentProps {
  title?: string;
  summary?: string;
  className?: string;
  readingTime?: ReadTimeResults;
  date?: string;
  tags?: string[];
  author?: string;
  editUrl?: string;
}

export const DetailHeader = forwardRef<HTMLElement, BlogContentProps>(
  function DetailHeader(
    { title, summary, className, readingTime, date, tags, author, editUrl },
    ref,
  ) {
    const parsedDate = useMemo(() => {
      if (!date) {
        return null;
      }
      const candidate = new Date(date);
      if (Number.isNaN(candidate.getTime())) {
        return null;
      }
      return candidate;
    }, [date]);

    const formattedDate = useMemo(() => {
      if (!parsedDate) {
        return date ?? null;
      }
      return new Intl.DateTimeFormat('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(parsedDate);
    }, [parsedDate, date]);

    const readingMinutes = useMemo(() => {
      if (!readingTime) return null;
      return Math.max(1, Math.ceil(readingTime.minutes));
    }, [readingTime]);

    const readingWords = readingTime?.words;

    const tagList = tags?.filter(Boolean) ?? [];

    return (
      <div className={cn('min-w-0 flex-1', className)}>
        <motion.article
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-none"
        >
          {(title || summary) && (
            <header ref={ref} className="mb-10 space-y-6">
              {title && (
                <h1 className="text-balance text-left text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-400 sm:text-4xl">
                  {title}
                </h1>
              )}

              {(author || formattedDate || readingMinutes || editUrl) && (
                <div className="flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    {author && (
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-4 w-4" />
                        {author}
                      </span>
                    )}
                    {formattedDate && (
                      <time
                        dateTime={parsedDate?.toISOString() ?? undefined}
                        className="inline-flex items-center gap-1.5"
                      >
                        <CalendarDays className="h-4 w-4" />
                        {formattedDate}
                      </time>
                    )}
                    {readingMinutes && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {readingMinutes} min read
                      </span>
                    )}
                    {readingWords && (
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-4 w-4" />
                        {readingWords} words
                      </span>
                    )}
                  </div>

                  {editUrl && (
                    <a
                      href={editUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 self-start rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-border hover:bg-muted/40"
                    >
                      <PencilLine className="h-4 w-4" />
                      Edit on GitHub
                    </a>
                  )}
                </div>
              )}

              {tagList.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {tagList.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/30 px-3 py-1"
                    >
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {summary && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="relative overflow-hidden rounded-2xl border border-border/70 bg-muted/30 p-6 shadow-sm"
                >
                  <div className="mb-4 flex items-center gap-3 text-sm font-semibold text-blue-600 dark:text-blue-400">
                    <span className="i-simple-icons-openai block h-5 w-5" />
                    AI 摘要
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {summary}
                  </p>
                </motion.div>
              )}
            </header>
          )}

          <MDXWrapper className="mt-8">
            <Outlet />
          </MDXWrapper>
          <LicenseNotice />
        </motion.article>
      </div>
    );
  },
);
