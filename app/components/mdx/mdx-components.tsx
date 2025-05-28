import { ReactNode, useState } from 'react';
import { cn } from '~/utils';

// 类型定义
interface HeadingProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

interface ParagraphProps {
  children: ReactNode;
  className?: string;
}

interface LinkProps {
  children: ReactNode;
  href?: string;
  className?: string;
}

interface ListProps {
  children: ReactNode;
  className?: string;
}

interface CodeProps {
  children: ReactNode;
  className?: string;
}

interface BlockquoteProps {
  children: ReactNode;
  className?: string;
}

interface PreProps {
  children: ReactNode;
  className?: string;
}

// 标题组件 - 简洁的层次设计
export const H1 = ({ children, className, id, ...props }: HeadingProps & any) => (
  <h1
    id={id}
    className={cn(
      'text-3xl md:text-4xl font-bold mb-8 mt-12 first:mt-0',
      'text-zinc-900 dark:text-zinc-100',
      'tracking-tight leading-tight',
      'border-b border-zinc-200/50 dark:border-zinc-700/50 pb-4',
      'group heading-group',
      className
    )}
    {...props}
  >
    {children}
    {id && (
      <a 
        href={`#${id}`} 
        className="heading-anchor text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        aria-label={`链接到 ${children}`}
      >
        #
      </a>
    )}
  </h1>
);

export const H2 = ({ children, className, id, ...props }: HeadingProps & any) => (
  <h2
    id={id}
    className={cn(
      'text-2xl md:text-3xl font-semibold mb-6 mt-10',
      'text-zinc-800 dark:text-zinc-200',
      'tracking-tight leading-snug',
      'group heading-group relative',
      className
    )}
    {...props}
  >
    <span className="absolute -left-4 opacity-0 group-hover:opacity-50 transition-opacity text-zinc-400">#</span>
    {children}
    {id && (
      <a 
        href={`#${id}`} 
        className="heading-anchor text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        aria-label={`链接到 ${children}`}
      >
        #
      </a>
    )}
  </h2>
);

export const H3 = ({ children, className, id, ...props }: HeadingProps & any) => (
  <h3
    id={id}
    className={cn(
      'text-xl md:text-2xl font-semibold mb-4 mt-8',
      'text-zinc-800 dark:text-zinc-200',
      'tracking-tight',
      'group heading-group relative',
      className
    )}
    {...props}
  >
    <span className="absolute -left-3 opacity-0 group-hover:opacity-50 transition-opacity text-zinc-400 text-base">##</span>
    {children}
    {id && (
      <a 
        href={`#${id}`} 
        className="heading-anchor text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        aria-label={`链接到 ${children}`}
      >
        #
      </a>
    )}
  </h3>
);

export const H4 = ({ children, className, id, ...props }: HeadingProps & any) => (
  <h4
    id={id}
    className={cn(
      'text-lg md:text-xl font-medium mb-3 mt-6',
      'text-zinc-700 dark:text-zinc-300',
      'tracking-tight',
      'group heading-group',
      className
    )}
    {...props}
  >
    {children}
    {id && (
      <a 
        href={`#${id}`} 
        className="heading-anchor text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        aria-label={`链接到 ${children}`}
      >
        #
      </a>
    )}
  </h4>
);

export const H5 = ({ children, className, id, ...props }: HeadingProps & any) => (
  <h5
    id={id}
    className={cn(
      'text-base md:text-lg font-medium mb-3 mt-5',
      'text-zinc-700 dark:text-zinc-300',
      'group heading-group',
      className
    )}
    {...props}
  >
    {children}
    {id && (
      <a 
        href={`#${id}`} 
        className="heading-anchor text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        aria-label={`链接到 ${children}`}
      >
        #
      </a>
    )}
  </h5>
);

export const H6 = ({ children, className, id, ...props }: HeadingProps & any) => (
  <h6
    id={id}
    className={cn(
      'text-sm md:text-base font-medium mb-2 mt-4',
      'text-zinc-600 dark:text-zinc-400',
      'uppercase tracking-wider',
      'group heading-group',
      className
    )}
    {...props}
  >
    {children}
    {id && (
      <a 
        href={`#${id}`} 
        className="heading-anchor text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        aria-label={`链接到 ${children}`}
      >
        #
      </a>
    )}
  </h6>
);

// 段落组件 - 舒适的行高和间距
export const P = ({ children, className, ...props }: ParagraphProps & any) => (
  <p
    className={cn(
      'text-base md:text-lg leading-7 md:leading-8 mb-6',
      'text-zinc-700 dark:text-zinc-300',
      'font-normal',
      className
    )}
    {...props}
  >
    {children}
  </p>
);

// 链接组件 - 优雅的悬停效果
export const A = ({ children, href, className, ...props }: LinkProps & any) => {
  const isExternal = href?.startsWith('http') || href?.startsWith('//');
  const isEmail = href?.startsWith('mailto:');
  
  return (
    <a
      href={href}
      className={cn(
        'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300',
        'underline decoration-blue-300 dark:decoration-blue-600 decoration-1',
        'underline-offset-2 hover:decoration-2',
        'transition-all duration-200 ease-out',
        'font-medium inline-flex items-center gap-1',
        className
      )}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      {...props}
    >
      {children}
      {isExternal && (
        <span className="text-xs opacity-70">
          ↗
        </span>
      )}
      {isEmail && (
        <span className="text-xs opacity-70">
          ✉
        </span>
      )}
    </a>
  );
};

// 列表组件 - 清晰的层次和间距
export const UL = ({ children, className, ...props }: ListProps & any) => (
  <ul
    className={cn(
      'list-none mb-6 pl-0 space-y-2',
      'text-zinc-700 dark:text-zinc-300',
      className
    )}
    {...props}
  >
    {children}
  </ul>
);

export const OL = ({ children, className, ...props }: ListProps & any) => (
  <ol
    className={cn(
      'list-none mb-6 pl-0 space-y-2 mdx-content',
      'text-zinc-700 dark:text-zinc-300',
      className
    )}
    {...props}
  >
    {children}
  </ol>
);

export const LI = ({ children, className, ...props }: any) => (
  <li
    className={cn(
      'relative pl-6 leading-7',
      'before:content-["•"] before:absolute before:left-0 before:text-zinc-400 before:font-bold',
      '[ol_&]:before:content-none', // 移除有序列表中的点
      className
    )}
    {...props}
  >
    {children}
  </li>
);

// 引用块 - 优雅的左边框设计
export const Blockquote = ({ children, className, ...props }: BlockquoteProps & any) => (
  <blockquote
    className={cn(
      'border-l-4 border-zinc-300 dark:border-zinc-600 pl-6 py-2 mb-6',
      'bg-zinc-50/50 dark:bg-zinc-800/20 rounded-r-lg',
      'text-zinc-600 dark:text-zinc-400 italic',
      'font-medium text-lg leading-relaxed',
      className
    )}
    {...props}
  >
    {children}
  </blockquote>
);

// 行内代码 - 柔和的背景色
export const Code = ({ children, className, ...props }: CodeProps & any) => (
  <code
    className={cn(
      'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200',
      'px-1.5 py-0.5 rounded text-sm font-mono',
      'border border-zinc-200 dark:border-zinc-700',
      className
    )}
    {...props}
  >
    {children}
  </code>
);

// 代码块 - 现代化的设计
export const Pre = ({ children, className, ...props }: PreProps & any) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = async () => {
    const codeElement = props.children?.props?.children;
    if (typeof codeElement === 'string') {
      try {
        await navigator.clipboard.writeText(codeElement);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  };

  return (
    <div className="relative mb-6 group code-block-wrapper">
      <pre
        className={cn(
          'bg-zinc-900 dark:bg-zinc-950 text-zinc-100',
          'p-4 rounded-lg overflow-x-auto',
          'border border-zinc-200 dark:border-zinc-800',
          'font-mono text-sm leading-6',
          'shadow-lg',
          className
        )}
        {...props}
      >
        {children}
      </pre>
      <button
        onClick={handleCopy}
        className="copy-code-button"
        title="复制代码"
      >
        {copied ? '已复制!' : '复制'}
      </button>
    </div>
  );
};

// 水平分割线
export const HR = ({ className, ...props }: any) => (
  <hr
    className={cn(
      'border-none h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent dark:via-zinc-600',
      'my-12 mx-auto w-1/2',
      className
    )}
    {...props}
  />
);

// 图片组件 - 响应式和圆角设计
export const Img = ({ className, alt, ...props }: any) => (
  <img
    className={cn(
      'rounded-lg shadow-md max-w-full h-auto mb-6',
      'border border-zinc-200 dark:border-zinc-700',
      className
    )}
    alt={alt}
    {...props}
  />
);

// 表格组件
export const Table = ({ children, className, ...props }: any) => (
  <div className="overflow-x-auto mb-6">
    <table
      className={cn(
        'w-full border-collapse',
        'bg-white dark:bg-zinc-900',
        'border border-zinc-200 dark:border-zinc-700 rounded-lg',
        'shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </table>
  </div>
);

export const TH = ({ children, className, ...props }: any) => (
  <th
    className={cn(
      'border-b border-zinc-200 dark:border-zinc-700 px-4 py-3',
      'text-left font-semibold text-zinc-800 dark:text-zinc-200',
      'bg-zinc-50 dark:bg-zinc-800/50',
      className
    )}
    {...props}
  >
    {children}
  </th>
);

export const TD = ({ children, className, ...props }: any) => (
  <td
    className={cn(
      'border-b border-zinc-100 dark:border-zinc-800 px-4 py-3',
      'text-zinc-700 dark:text-zinc-300',
      className
    )}
    {...props}
  >
    {children}
  </td>
);

// 特殊组件 - 类似 antfu.me 的提示框
interface CalloutProps {
  type?: 'info' | 'warning' | 'error' | 'success' | 'note';
  children: ReactNode;
  title?: string;
  className?: string;
}

export const Callout = ({ type = 'info', children, title, className }: CalloutProps) => {
  const typeStyles = {
    info: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200',
    warning: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200',
    error: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
    note: 'bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200',
  };

  const icons = {
    info: '💡',
    warning: '⚠️',
    error: '❌',
    success: '✅',
    note: '📝',
  };

  return (
    <div
      className={cn(
        'relative p-4 mb-6 border rounded-lg',
        'backdrop-blur-sm',
        typeStyles[type],
        className
      )}
    >
      {title && (
        <div className="flex items-center gap-2 mb-2 font-semibold">
          <span>{icons[type]}</span>
          <span>{title}</span>
        </div>
      )}
      <div className="prose prose-sm max-w-none">
        {children}
      </div>
    </div>
  );
};

// 代码组 - 用于展示多个相关的代码示例
interface CodeGroupProps {
  children: ReactNode;
  titles?: string[];
  className?: string;
}

export const CodeGroup = ({ children, titles = [], className }: CodeGroupProps) => {
  const [activeTab, setActiveTab] = useState(0);
  
  return (
    <div className={cn('mb-6', className)}>
      {titles.length > 0 && (
        <div className="flex border-b border-zinc-200 dark:border-zinc-700 mb-0">
          {titles.map((title, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                activeTab === index
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
              )}
            >
              {title}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        {Array.isArray(children) ? children[activeTab] : children}
      </div>
    </div>
  );
};

// 导出所有组件的映射对象
export const mdxComponents = {
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  h5: H5,
  h6: H6,
  p: P,
  a: A,
  ul: UL,
  ol: OL,
  li: LI,
  blockquote: Blockquote,
  code: Code,
  pre: Pre,
  hr: HR,
  img: Img,
  table: Table,
  th: TH,
  td: TD,
  // 特殊组件
  Callout,
  CodeGroup,
};
