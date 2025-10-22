import { Link, useLocation } from '@remix-run/react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PostInfo } from '~/types';
import { cn } from '~/core/utils';
import { useTranslation } from '~/core/i18n';

interface BlogNavigationProps {
  list: PostInfo[];
  className?: string;
}

export function BlogNavigation({ list, className }: BlogNavigationProps) {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const currentIndex = list.findIndex((item) => item.url === pathname);
  const prevPost = currentIndex > 0 ? list[currentIndex - 1] : null;
  const nextPost =
    currentIndex < list.length - 1 ? list[currentIndex + 1] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn('w-full space-y-6', className)}
    >
      {(prevPost || nextPost) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* 上一篇 */}
          <div className="flex justify-start">
            {prevPost ? (
              <Link
                to={prevPost.url}
                className={cn(
                  'group flex items-center gap-3 rounded-xl p-4',
                  'from-muted/50 bg-gradient-to-r to-transparent',
                  'border-border/30 hover:border-border/60 border',
                  'transition-all duration-300',
                  'hover:from-muted/80 hover:to-muted/20 hover:bg-gradient-to-r',
                  'transform hover:-translate-y-1 hover:shadow-lg',
                  'w-full max-w-sm',
                )}
              >
                <div className="flex-shrink-0">
                  <ChevronLeft className="text-muted-foreground group-hover:text-foreground h-5 w-5 transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-muted-foreground mb-1 text-xs font-medium">
                    {t('blog.detail.previousPost')}
                  </div>
                  <div className="group-hover:text-main-500 truncate text-sm font-medium transition-colors">
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
                  'group flex items-center gap-3 rounded-xl p-4',
                  'from-muted/50 bg-gradient-to-l to-transparent',
                  'border-border/30 hover:border-border/60 border',
                  'transition-all duration-300',
                  'hover:from-muted/80 hover:to-muted/20 hover:bg-gradient-to-l',
                  'transform hover:-translate-y-1 hover:shadow-lg',
                  'w-full max-w-sm text-right',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-muted-foreground mb-1 text-xs font-medium">
                    {t('blog.detail.nextPost')}
                  </div>
                  <div className="group-hover:text-main-500 truncate text-sm font-medium transition-colors">
                    {nextPost.title}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <ChevronRight className="text-muted-foreground group-hover:text-foreground h-5 w-5 transition-colors" />
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
