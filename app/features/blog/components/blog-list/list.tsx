import { PostInfo } from "~/types";
import { Link } from "@remix-run/react";
import { cn } from "~/core/utils";
import { Time } from "~/core/ui/common/time";
import { usePrefersReducedMotion } from "~/core/hooks/use-prefers-reduced-motion";

interface BaseBlogListProps {
  list: PostInfo[];
}

export default function List({ list }: BaseBlogListProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const cardInteractionClasses = prefersReducedMotion
    ? "transition-none"
    : "transition-transform transition-colors duration-fast ease-standard motion-safe:hover:-translate-y-1 motion-safe:hover:shadow-lg";

  return (
    <div
      data-testid="blog-list-container"
      className="mx-auto w-full max-w-5xl px-inline-sm pt-[calc(var(--space-stack-lg)*1.5)] sm:px-inline-md"
    >
      <div
        data-testid="blog-list-grid"
        className={cn(
          "grid w-full gap-y-stack-md",
          "sm:gap-y-stack-lg",
          "lg:grid-cols-2 lg:gap-x-inline-md lg:[grid-auto-rows:1fr]",
        )}
      >
        {list.map((li) => (
          <article key={li.filename} className="contents">
            <Link
              to={li.url}
              className={cn(
                "group flex h-full w-full transform flex-col gap-stack-sm rounded-2xl border border-border/60 bg-background/80 text-foreground shadow-sm",
                "px-inline-sm py-stack-md sm:p-inset-md lg:p-inset-md",
                "hover:bg-muted/40 dark:hover:bg-muted/20",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                cardInteractionClasses,
              )}
            >
              <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
                {li.title}
              </h3>
              <div className="text-muted-foreground flex flex-wrap items-center gap-inline-sm text-sm">
                <Time time={li.time} />
                {li.tags?.length ? (
                  <div className="flex flex-wrap items-center gap-inline-sm">
                    <span aria-hidden className="i-simple-line-icons-tag h-3 w-3" />
                    {li.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-muted/40 px-2 py-1 text-xs font-medium uppercase tracking-wide"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
