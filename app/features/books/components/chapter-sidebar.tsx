import { Link, useParams } from "@remix-run/react";
import { cn } from "~/core/utils";
import type { BookSummaryInfo } from "~/types";
import { useTranslation } from "~/core/i18n";

interface BookChapterSidebarProps {
  book: BookSummaryInfo;
  activeChapterId?: string | null;
  onNavigate?: () => void;
}

export function BookChapterSidebar({
  book,
  activeChapterId,
  onNavigate,
}: BookChapterSidebarProps) {
  const { t } = useTranslation();
  const params = useParams<{ chapterId?: string }>();
  const currentChapter =
    activeChapterId ?? params.chapterId ?? book.defaultChapterId ?? null;

  return (
    <nav className="border-border/60 bg-background/80 dark:bg-background/60 flex flex-col gap-4 rounded-2xl border p-5 shadow-sm backdrop-blur">
      <header className="space-y-1">
        <p className="text-muted-foreground text-xs tracking-wide uppercase">
          {t("books.sidebar.sectionLabel")}
        </p>
        <h2 className="text-foreground text-base font-semibold">
          {book.title}
        </h2>
        {book.description ? (
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            {book.description}
          </p>
        ) : null}
      </header>

      <ul className="flex flex-1 flex-col gap-2 text-sm">
        {book.chapters.map((chapter, index) => {
          const isActive = currentChapter === chapter.id;

          return (
            <li key={chapter.id}>
              <Link
                to={`/books/${book.id}/${chapter.id}`}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-left transition",
                  isActive
                    ? "border-main-500 bg-main-500/10 text-main-500 dark:text-main-400"
                    : "text-muted-foreground hover:border-main-500/40 hover:bg-main-500/5",
                )}
                prefetch="intent"
              >
                <span className="bg-main-500/10 text-main-500 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
                  {index + 1}
                </span>
                <span className="flex-1 text-sm leading-snug">
                  {chapter.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
