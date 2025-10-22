import { Outlet } from '@remix-run/react';
import { motion } from 'motion/react';
import type { ReadTimeResults } from 'reading-time';
import { forwardRef, useMemo } from 'react';
import {
  CalendarDays,
  Clock,
  FileText,
  PencilLine,
  Tag,
  UserRound,
} from 'lucide-react';
import { MDXWrapper } from '~/core/mdx/mdx-wrapper';
import { LicenseNotice } from '~/core/ui/common/license-notice';
import { cn } from '~/core/utils';
import { useTranslation } from '~/core/i18n';

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
    const { t, locale } = useTranslation();
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

    const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';

    const formattedDate = useMemo(() => {
      if (!parsedDate) {
        return date ?? null;
      }
      return new Intl.DateTimeFormat(localeCode, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(parsedDate);
    }, [parsedDate, date, localeCode]);

    const readingMinutes = useMemo(() => {
      if (!readingTime) return null;
      return Math.max(1, Math.ceil(readingTime.minutes));
    }, [readingTime]);

    const readingWords = readingTime?.words;
    const numberFormatter = useMemo(
      () => new Intl.NumberFormat(localeCode),
      [localeCode],
    );

    const readingMinutesLabel =
      readingMinutes !== null
        ? t('blog.detail.readTime', {
            replace: { count: numberFormatter.format(readingMinutes) },
          })
        : null;

    const readingWordsLabel = readingWords
      ? t('blog.detail.readWords', {
          replace: { count: numberFormatter.format(readingWords) },
        })
      : null;

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
                <h1 className="text-left text-3xl font-bold tracking-tight text-balance text-blue-600 sm:text-4xl dark:text-blue-400">
                  {title}
                </h1>
              )}

              {(author || formattedDate || readingMinutes || editUrl) && (
                <div className="border-border/70 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
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
                    {readingMinutesLabel && (
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {readingMinutesLabel}
                      </span>
                    )}
                    {readingWordsLabel && (
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-4 w-4" />
                        {readingWordsLabel}
                      </span>
                    )}
                  </div>

                  {/* {editUrl && (
                    <a
                      href={editUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 self-start rounded-full border border-border/70 bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:border-border hover:bg-muted/40"
                    >
                      <PencilLine className="h-4 w-4" />
                      {t('blog.detail.editOnGitHub')}
                    </a>
                  )} */}
                </div>
              )}

              {tagList.length > 0 && (
                <div className="text-muted-foreground flex flex-wrap gap-2 text-xs font-medium tracking-wide uppercase">
                  {tagList.map((tag) => (
                    <span
                      key={tag}
                      className="border-border/70 bg-muted/30 inline-flex items-center gap-1 rounded-full border px-3 py-1"
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
                  className="border-border/70 bg-muted/30 relative overflow-hidden rounded-2xl border p-6 shadow-sm"
                >
                  <div className="mb-4 flex items-center gap-3 text-sm font-semibold text-blue-600 dark:text-blue-400">
                    <span className="i-simple-icons-openai block h-5 w-5" />
                    {t('blog.detail.aiSummary')}
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
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
