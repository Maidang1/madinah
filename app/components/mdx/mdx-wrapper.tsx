import { ReactNode } from 'react';
import { cn } from '~/utils';

interface MDXWrapperProps {
  children: ReactNode;
  className?: string;
}

export function MDXWrapper({ children, className }: MDXWrapperProps) {
  return (
    <div 
      className={cn(
        'mdx-content prose-none max-w-none',
        'text-zinc-700 dark:text-zinc-300',
        // 确保平滑滚动
        'scroll-smooth',
        // 设置最大宽度和居中
        'mx-auto',
        // 添加适当的内边距
        'px-4 sm:px-6 lg:px-8',
        className
      )}
    >
      {children}
    </div>
  );
}
