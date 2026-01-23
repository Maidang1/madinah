import { useState, useEffect, useRef } from 'react';
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
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    // Restore focus to trigger button when closing
    setTimeout(() => {
      triggerButtonRef.current?.focus();
    }, 100);
  };

  // Focus management for modal
  useEffect(() => {
    if (isOpen) {
      // Focus the close button when modal opens
      setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 100);

      // Handle escape key
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };

      // Trap focus within modal
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          const modal = document.getElementById('mobile-toc-content');
          if (!modal) return;

          const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0] as HTMLElement;
          const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement?.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement?.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleEscape);
      document.addEventListener('keydown', handleTabKey);

      return () => {
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('keydown', handleTabKey);
      };
    }
  }, [isOpen]);

  return (
    <div className={cn('lg:hidden', className)}>
      {/* 触发按钮 */}
      <button
        ref={triggerButtonRef}
        onClick={handleOpen}
        className={cn(
          'fixed top-20 right-4 z-40 rounded-full p-3',
          'bg-surface-raised-base border-border-weak border',
          'shadow-lg',
          'text-text-weak hover:text-text-strong',
          'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
        )}
        aria-label={t('blog.detail.mobileToggleToc')}
        aria-expanded={isOpen}
        aria-controls="mobile-toc-content"
      >
        <svg
          className={cn(
            'block h-5 w-5 transition-transform duration-200',
            isOpen && 'rotate-45'
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* 进度指示器 */}
      <div className="fixed top-0 right-0 left-0 z-30 h-1 bg-gray-200 dark:bg-gray-800">
        <progress
          value={progress}
          max={100}
          className="sr-only"
          aria-label={t('blog.detail.readingProgress')}
        >
          {progress}%
        </progress>
        <div
          className="h-full bg-blue-600 dark:bg-blue-400 transition-all duration-200"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('blog.detail.readingProgress')}
        />
      </div>

      {/* 遮罩层 */}
      {isOpen && (
        <div
          className="bg-surface-raised-base/50 fixed inset-0 z-30 backdrop-blur-sm"
          onClick={handleClose}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              handleClose();
            }
          }}
          role="button"
          tabIndex={-1}
          aria-label={t('blog.detail.mobileCloseToc')}
        />
      )}

      {/* 目录内容 */}
      {isOpen && (
        <div
          id="mobile-toc-content"
          className={cn(
            'fixed top-0 right-0 bottom-0 z-40 w-80 max-w-[90vw] sm:max-w-[85vw]',
            'bg-surface-raised-base border-border-weak border-l shadow-2xl',
            'overflow-y-auto overscroll-contain',
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-toc-title"
        >
          <div className="p-4 sm:p-6">
            {/* 头部 */}
            <div className="mb-4 sm:mb-6 flex items-center justify-between">
              <h2 id="mobile-toc-title" className="sr-only">
                {t('blog.detail.tableOfContents')}
              </h2>
              <button
                ref={closeButtonRef}
                onClick={handleClose}
                className="hover:bg-surface-flat-base-hover text-text-weak hover:text-text-strong rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={t('blog.detail.mobileCloseToc')}
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
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
