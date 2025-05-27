import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NavLink } from '@remix-run/react';
import { cn } from '~/lib/utils';
import { useTableOfContents } from './hooks/use-table-of-contents';
import { TocItem } from './types';
import { Tocs } from './tocs';

interface MobileTableOfContentsProps {
  tocs: TocItem[];
  className?: string;
}

export function MobileTableOfContents({ tocs, className }: MobileTableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { activeId, handleClick } = useTableOfContents({ tocs });

  if (tocs.length === 0) {
    return null;
  }

  const activeIndex = tocs.findIndex(toc => toc.url.slice(1) === activeId);
  const progress = activeIndex >= 0 ? ((activeIndex + 1) / tocs.length) * 100 : 0;

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
    handleClick(e, url);
    setIsOpen(false); // 点击后关闭菜单
  };

  return (
    <div className={cn('lg:hidden', className)}>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed top-20 right-4 z-40 p-3 rounded-full',
          'bg-background/80 backdrop-blur-sm border border-border',
          'shadow-lg hover:shadow-xl transition-all duration-200',
          'text-muted-foreground hover:text-foreground',
          isOpen && 'text-primary bg-primary/10'
        )}
        aria-label='Toggle table of contents'
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <span className='i-simple-line-icons-menu w-5 h-5 block' />
        </motion.div>
      </button>

      {/* 进度指示器 */}
      <div className='fixed top-0 left-0 right-0 z-30 h-1 bg-muted'>
        <div
          className='h-full bg-primary transition-all duration-300 ease-out'
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
            className='fixed inset-0 bg-background/50 backdrop-blur-sm z-30'
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
              'bg-background border-l border-border shadow-2xl',
              'overflow-y-auto overscroll-contain'
            )}
          >
            <div className='p-6'>
              {/* 头部 */}
              <div className='flex items-center justify-between mb-6'>
                <h3 className='font-medium text-lg flex items-center'>
                  <span className='i-lucide-list-ordered mr-2 w-5 h-5' />
                  目录
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className='p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground'
                  aria-label='Close table of contents'
                >
                  <span className='i-lucide-x w-4 h-4 block' />
                </button>
              </div>



              {/* 目录列表 */}
              <Tocs tocs={tocs} activeId={activeId} progress={progress} onLinkClick={handleLinkClick} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
