import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '~/core/utils';
import { useTableOfContents } from '~/features/blog/hooks/use-table-of-contents';
import { TocItem } from '~/types';
import { Tocs } from './tocs';
import { useTranslation } from '~/core/i18n';

interface MobileTableOfContentsProps {
  tocs: TocItem[];
  className?: string;
}

export function TableOfContentsMobile({
  tocs,
  className,
}: MobileTableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { activeId, handleClick } = useTableOfContents({ tocs });
  const { t } = useTranslation();

  if (tocs.length === 0) {
    return null;
  }

  const activeIndex = tocs.findIndex((toc) => toc.url.slice(1) === activeId);
  const progress =
    activeIndex >= 0 ? ((activeIndex + 1) / tocs.length) * 100 : 0;

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    url: string,
  ) => {
    handleClick(e, url);
    setIsOpen(false); // 点击后关闭菜单
  };

  return (
    <div className={cn('lg:hidden', className)}>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed top-20 right-4 z-40 rounded-full p-3',
          'bg-background/80 border-border border backdrop-blur-sm',
          'shadow-lg transition-all duration-200 hover:shadow-xl',
          'text-muted-foreground hover:text-foreground',
          isOpen && 'text-primary bg-primary/10',
        )}
        aria-label={t('blog.detail.mobileToggleToc')}
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <span className="i-simple-line-icons-menu block h-5 w-5" />
        </motion.div>
      </button>

      {/* 进度指示器 */}
      <div className="fixed top-0 right-0 left-0 z-30 h-1 bg-gray-500/50">
        <div
          className="h-full bg-gray-700 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 遮罩层 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-background/50 fixed inset-0 z-30 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* 目录内容 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={cn(
              'fixed top-0 right-0 bottom-0 z-40 w-80 max-w-[90vw]',
              'bg-background border-border border-l shadow-2xl',
              'overflow-y-auto overscroll-contain',
            )}
          >
            <div className="p-6">
              {/* 头部 */}
              <div className="mb-6 flex items-center justify-between">
                <button
                  onClick={() => setIsOpen(false)}
                  className="hover:bg-accent text-muted-foreground hover:text-foreground rounded-md p-2"
                  aria-label={t('blog.detail.mobileCloseToc')}
                >
                  <span className="i-lucide-x block h-4 w-4" />
                </button>
              </div>

              {/* 目录列表 */}
              <Tocs
                tocs={tocs}
                activeId={activeId}
                progress={progress}
                onLinkClick={handleLinkClick}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
