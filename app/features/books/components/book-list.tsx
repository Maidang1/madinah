import { Link } from "@remix-run/react";
import { motion } from "motion/react";
import { cn } from "~/core/utils";
import type { BookSummaryInfo } from "~/types";

interface BookListProps {
  books: BookSummaryInfo[];
}

export function BookList({ books }: BookListProps) {
  if (!books.length) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-semibold">书籍正在整理中</p>
        <p className="text-sm">稍后再来看看，也许就会有新的内容。</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {books.map((book, index) => (
        <motion.div
          key={book.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className="group border-border/60 bg-background/70 hover:border-main-400 dark:bg-background/60 relative h-full overflow-hidden rounded-2xl border p-6 shadow-sm backdrop-blur transition hover:shadow-lg"
        >
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-foreground text-xl font-semibold">
                  {book.title}
                </h2>
                {book.author ? (
                  <p className="text-muted-foreground mt-1 text-sm">
                    作者：{book.author}
                  </p>
                ) : null}
              </div>
              <div className="bg-main-500/10 text-main-500 rounded-full px-3 py-1 text-xs font-medium">
                {book.chapterCount} 章
              </div>
            </div>

            <p className="text-muted-foreground line-clamp-3 text-sm">
              {book.description}
            </p>

            {book.tags.length ? (
              <div className="text-main-500 flex flex-wrap gap-2 text-xs">
                {book.tags.map((tag) => (
                  <span
                    key={tag}
                    className="border-main-500/30 rounded-full border px-2 py-1"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-auto flex items-center justify-between pt-2">
              <Link
                to={`/books/${book.id}`}
                className={cn(
                  "bg-main-500 inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold text-white transition",
                  "group-hover:translate-x-1",
                )}
              >
                开始阅读
              </Link>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
