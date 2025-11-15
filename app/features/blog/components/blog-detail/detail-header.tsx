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
import type { PostGitInfo } from '~/types';
import { HistoryVersions } from './history-version';

interface BlogContentProps {
  title?: string;
  summary?: string;
  className?: string;
  readingTime?: ReadTimeResults;
  date?: string;
  tags?: string[];
  author?: string;
  editUrl?: string;
  gitInfo?: PostGitInfo;
}

export const DetailHeader = forwardRef<HTMLElement, BlogContentProps>(
  function DetailHeader(
    { title, className, readingTime, date, tags, author, editUrl, gitInfo },
    ref,
  ) {
    const { t, locale } = useTranslation();
    // Use Git creation time if available, otherwise fall back to frontmatter date
    const effectiveDate = gitInfo?.createdAt || date;
    const lastModified = gitInfo?.updatedAt;

    const parsedDate = useMemo(() => {
      if (!effectiveDate) {
        return null;
      }
      const candidate = new Date(effectiveDate);
      if (Number.isNaN(candidate.getTime())) {
        return null;
      }
      return candidate;
    }, [effectiveDate]);

    const parsedLastModified = useMemo(() => {
      if (!lastModified) return null;
      const candidate = new Date(lastModified);
      return Number.isNaN(candidate.getTime()) ? null : candidate;
    }, [lastModified]);

    const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';

    const formattedDate = useMemo(() => {
      if (!parsedDate) {
        return effectiveDate ?? null;
      }
      return new Intl.DateTimeFormat(localeCode, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(parsedDate);
    }, [parsedDate, effectiveDate, localeCode]);

    const formattedLastModified = useMemo(() => {
      if (!parsedLastModified) return null;
      return new Intl.DateTimeFormat(localeCode, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(parsedLastModified);
    }, [parsedLastModified, localeCode]);

    // Check if post was updated (more than 24 hours difference)
    const wasUpdated = useMemo(() => {
      if (!gitInfo) return false;
      const created = new Date(gitInfo.createdAt).getTime();
      const updated = new Date(gitInfo.updatedAt).getTime();
      return updated - created > 24 * 60 * 60 * 1000;
    }, [gitInfo]);

    const readingMinutes = useMemo(() => {
      if (!readingTime) return null;
      return Math.max(1, Math.ceil(readingTime.minutes));
    }, [readingTime]);

    const readingWords = readingTime?.words;
    const numberFormatter = useMemo(
      () => new Intl.NumberFormat(localeCode),
      [localeCode],
    );

    const readingMinutesLabel: string =
      readingMinutes !== null
        ? t('blog.detail.readTime', {
            replace: { count: numberFormatter.format(readingMinutes) },
          })
        : '';

    const readingWordsLabel: string = readingWords
      ? t('blog.detail.readWords', {
          replace: { count: numberFormatter.format(readingWords) },
        })
      : '';

    const tagList = tags?.filter(Boolean) ?? [];

    return (
      <div className={cn('min-w-0 flex-1', className)}>
        <motion.article
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-none"
        >
          {title && (
            <header ref={ref} className="mb-10 space-y-6">
              {title && (
                <h1 className="text-left text-3xl font-bold tracking-tight text-balance text-blue-600 sm:text-4xl dark:text-blue-400">
                  {title}
                </h1>
              )}

              {(author ||
                formattedDate ||
                readingMinutes ||
                wasUpdated ||
                editUrl) && (
                <div className="border-border/70 flex flex-col gap-4 border-b pb-6">
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    {author ? (
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-4 w-4" />
                        {author as string}
                      </span>
                    ) : null}
                    {formattedDate && (
                      <time
                        dateTime={parsedDate?.toISOString() ?? undefined}
                        className="inline-flex items-center gap-1.5"
                      >
                        <CalendarDays className="h-4 w-4" />
                        {formattedDate}
                      </time>
                    )}
                    {wasUpdated && formattedLastModified && (
                      <time
                        dateTime={
                          parsedLastModified?.toISOString() ?? undefined
                        }
                        className="inline-flex items-center gap-1.5"
                      >
                        <PencilLine className="h-4 w-4" />
                        {t('blog.detail.updated')}: {formattedLastModified}
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

                  {(gitInfo?.commits?.length ?? 0) > 0 && (
                    <HistoryVersions gitInfo={gitInfo} />
                  )}
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
