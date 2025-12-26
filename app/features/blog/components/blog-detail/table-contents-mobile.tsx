import { useState } from 'react';
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
          'bg-background border-border border',
          'shadow-lg',
          'text-muted-foreground hover:text-foreground',
          isOpen && 'text-primary bg-primary/10',
        )}
        aria-label={t('blog.detail.mobileToggleToc')}
      >
        <span className={cn("block h-5 w-5 i-simple-line-icons-menu", isOpen && "rotate-45 transition-transform duration-200")} />
      </button>

      {/* 进度指示器 */}
      <div className="fixed top-0 right-0 left-0 z-30 h-1 bg-gray-500/50">
        <div
          className="h-full bg-gray-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* 遮罩层 */}
      {isOpen && (
        <div
          className="bg-background/50 fixed inset-0 z-30 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* 目录内容 */}
      {isOpen && (
        <div
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
        </div>
      )}
    </div>
  );
}
