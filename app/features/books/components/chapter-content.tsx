import { motion } from "motion/react";
import type { ReactNode } from "react";
import { MDXWrapper } from "~/core/mdx/mdx-wrapper";
import { LicenseNotice } from "~/core/ui/common/license-notice";
import type { BookChapterInfo, BookSummaryInfo } from "~/types";

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
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="border-border/60 bg-background/80 dark:bg-background/60 min-w-0 rounded-2xl border p-8 shadow-sm backdrop-blur"
    >
      <header className="mb-10 space-y-4">
        <p className="text-gray-700 text-xs font-semibold uppercase tracking-wide">
          {book.title}
        </p>
        <h1 className="text-balance text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
          {chapter.title}
        </h1>
        {chapter.summary ? (
          <div className="border-gray-700/50 text-muted-foreground relative overflow-hidden rounded-xl border p-5 text-sm leading-relaxed">
            {chapter.summary}
          </div>
        ) : null}
      </header>

      <MDXWrapper className="mt-8 px-0 sm:px-0 lg:px-0">
        {children}
      </MDXWrapper>
      <LicenseNotice />
    </motion.article>
  );
}
