import { Outlet } from "@remix-run/react";
import { motion } from "motion/react";
import type { ReadTimeResults } from "reading-time";
import { MDXWrapper } from "~/components/mdx/mdx-wrapper";

interface BlogContentProps {
  title?: string;
  summary?: string;
  className?: string;
}

export function DetailHeader({ title, summary, className }: BlogContentProps) {
  return (
    <div className={`min-w-0 flex-1 ${className || ""}`}>
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-none"
      >
        {(title || summary) && (
          <header className="mb-8">
            {title && (
              <h1 className="mb-6 text-center text-3xl font-bold sm:text-4xl">
                {title}
              </h1>
            )}
            {summary && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="border-main-500 not-prose text-muted-foreground relative mb-8 overflow-hidden rounded-2xl border border-solid p-6 shadow-sm backdrop-blur-sm"
              >
                <div className="relative z-10 ">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg shadow-sm">
                      <span className="i-simple-icons-openai block h-4 w-4 text-main-500" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-main-500 text-sm font-semibold">
                        AI 摘要
                      </span>
                    </div>
                  </div>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-sm leading-relaxed !text-muted-foreground"
                  >
                    {summary}
                  </motion.p>
                </div>
              </motion.div>
            )}
          </header>
        )}
        <MDXWrapper className="mt-8 pb-[800px]">
          <Outlet />
        </MDXWrapper>
      </motion.article>
    </div>
  );
}
