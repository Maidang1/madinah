import { Link, useLocation } from "@remix-run/react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PostInfo } from "~/types";
import { cn } from "~/utils";

interface BlogNavigationProps {
  list: PostInfo[];
  className?: string;
}

export function BlogNavigation({ list, className }: BlogNavigationProps) {
  const { pathname } = useLocation();

  const currentIndex = list.findIndex((item) => item.url === pathname);
  const prevPost = currentIndex > 0 ? list[currentIndex - 1] : null;
  const nextPost = currentIndex < list.length - 1 ? list[currentIndex + 1] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("w-full space-y-6", className)}
    >
      {(prevPost || nextPost) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 上一篇 */}
          <div className="flex justify-start">
            {prevPost ? (
              <Link
                to={prevPost.url}
                className={cn(
                  "group flex items-center gap-3 p-4 rounded-xl",
                  "bg-gradient-to-r from-muted/50 to-transparent",
                  "border border-border/30 hover:border-border/60",
                  "transition-all duration-300",
                  "hover:bg-gradient-to-r hover:from-muted/80 hover:to-muted/20",
                  "transform hover:-translate-y-1 hover:shadow-lg",
                  "max-w-sm w-full"
                )}
              >
                <div className="flex-shrink-0">
                  <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground font-medium mb-1">
                    上一篇
                  </div>
                  <div className="text-sm font-medium group-hover:text-main-500 transition-colors truncate">
                    {prevPost.title}
                  </div>
                </div>
              </Link>
            ) : (
              <div className="w-full max-w-sm" /> // 占位符保持布局
            )}
          </div>

          {/* 下一篇 */}
          <div className="flex justify-end">
            {nextPost ? (
              <Link
                to={nextPost.url}
                className={cn(
                  "group flex items-center gap-3 p-4 rounded-xl",
                  "bg-gradient-to-l from-muted/50 to-transparent",
                  "border border-border/30 hover:border-border/60",
                  "transition-all duration-300",
                  "hover:bg-gradient-to-l hover:from-muted/80 hover:to-muted/20",
                  "transform hover:-translate-y-1 hover:shadow-lg",
                  "max-w-sm w-full text-right"
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground font-medium mb-1">
                    下一篇
                  </div>
                  <div className="text-sm font-medium group-hover:text-main-500 transition-colors truncate">
                    {nextPost.title}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </Link>
            ) : (
              <div className="w-full max-w-sm" /> // 占位符保持布局
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
