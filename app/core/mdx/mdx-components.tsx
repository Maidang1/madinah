import { ReactNode, useState } from 'react';
import { cn } from '~/core/utils';
import { Heading2, Heading3, Heading4, Heading5, Heading6 } from 'lucide-react';

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

// 标题组件 - 简洁的层次设计
export const H1 = ({
  children,
  className,
  id,
  ...props
}: HeadingProps & any) => (
  <h1
    id={id}
    className={cn(
      'mt-16 mb-10 text-3xl font-bold first:mt-0 md:text-4xl',
      'text-foreground',
      'leading-tight tracking-tight',
      'border-b border-border/50 pb-4',
      'group heading-group',
      className,
    )}
    {...props}
  >
    {children}
  </h1>
);

export const H2 = ({
  children,
  className,
  id,
  ...props
}: HeadingProps & any) => (
  <h2
    id={id}
    className={cn(
      'group mt-14 mb-8 text-2xl font-semibold md:text-3xl',
      'text-foreground',
      'leading-snug tracking-tight',
      'group heading-group relative',
      'flex items-center gap-1',
      className,
    )}
    {...props}
  >
    {children}
    <Heading2 className="text-muted-foreground text-2xl opacity-0 transition-opacity group-hover:opacity-100" />
  </h2>
);

export const H3 = ({
  children,
  className,
  id,
  ...props
}: HeadingProps & any) => (
  <h3
    id={id}
    className={cn(
      'mt-10 mb-6 text-xl font-semibold md:text-2xl',
      'text-foreground',
      'tracking-tight',
      'group heading-group relative',
      'flex items-center gap-1',
      className,
    )}
    {...props}
  >
    {children}
    <Heading3 className="text-muted-foreground text-xl opacity-0 transition-opacity group-hover:opacity-100" />
  </h3>
);

export const H4 = ({
  children,
  className,
  id,
  ...props
}: HeadingProps & any) => (
  <h4
    id={id}
    className={cn(
      'mt-8 mb-4 text-lg font-medium md:text-xl',
      'text-foreground',
      'tracking-tight',
      'group heading-group',
      'flex items-center gap-1',
      className,
    )}
    {...props}
  >
    {children}
    <Heading4 className="text-muted-foreground text-lg opacity-0 transition-opacity group-hover:opacity-100" />
  </h4>
);

export const H5 = ({
  children,
  className,
  id,
  ...props
}: HeadingProps & any) => (
  <h5
    id={id}
    className={cn(
      'mt-6 mb-4 text-base font-medium',
      'text-foreground',
      'group heading-group',
      'flex items-center gap-1',
      className,
    )}
    {...props}
  >
    {children}
    <Heading5 className="text-muted-foreground text-base opacity-0 transition-opacity group-hover:opacity-100" />
  </h5>
);

export const H6 = ({
  children,
  className,
  id,
  ...props
}: HeadingProps & any) => (
  <h6
    id={id}
    className={cn(
      'mt-6 mb-3 text-sm font-medium md:text-base',
      'text-foreground/80',
      'tracking-wider uppercase',
      'group heading-group',
      'flex items-center gap-1',
      className,
    )}
    {...props}
  >
    {children}
    <Heading6 className="text-muted-foreground text-sm opacity-0 transition-opacity group-hover:opacity-100" />
  </h6>
);

// 段落组件 - 舒适的行高和间距
export const P = ({ children, className, ...props }: ParagraphProps & any) => (
  <p
    className={cn(
      'mb-8 text-lg leading-8',
      'text-foreground/90',
      'font-normal',
      className,
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
        'text-foreground',
        'underline decoration-foreground/30 underline-offset-4 decoration-1',
        'hover:decoration-foreground hover:decoration-2',
        'transition-all duration-200 ease-out',
        'inline-flex items-center gap-1 font-medium',
        className,
      )}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      {...props}
    >
      {children}
      {isExternal && <span className="text-xs opacity-70">↗</span>}
      {isEmail && <span className="text-xs opacity-70">✉</span>}
    </a>
  );
};

// 列表组件 - 清晰的层次和间距
export const UL = ({ children, className, ...props }: ListProps & any) => (
  <ul
    className={cn(
      'mb-8 list-none space-y-3 pl-0',
      'text-foreground/90',
      className,
    )}
    {...props}
  >
    {children}
  </ul>
);

export const OL = ({ children, className, ...props }: ListProps & any) => (
  <ol
    className={cn(
      'mdx-content mb-8 list-none space-y-3 pl-0',
      'text-foreground/90',
      className,
    )}
    {...props}
  >
    {children}
  </ol>
);

export const LI = ({ children, className, ...props }: any) => (
  <li
    className={cn(
      'relative pl-6 text-lg leading-8',
      'before:absolute before:left-0 before:font-bold before:text-foreground/40 before:content-["•"]',
      '[ol_&]:before:content-none', // 移除有序列表中的点
      className,
    )}
    {...props}
  >
    {children}
  </li>
);

// 引用块 - 优雅的左边框设计
export const Blockquote = ({
  children,
  className,
  ...props
}: BlockquoteProps & any) => (
  <blockquote
    className={cn(
      'mb-8 border-l-4 border-border py-3 pl-6',
      'bg-muted/30',
      'text-foreground/80 italic',
      'text-xl leading-relaxed font-medium',
      className,
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
      'rounded border-0 px-1.5 py-0.5 font-mono text-sm',
      'bg-muted text-foreground',
      'border border-border',
      className,
    )}
    {...props}
  >
    {children}
  </code>
);

// 水平分割线
export const HR = ({ className, ...props }: any) => (
  <hr
    className={cn(
      'h-px border-none bg-gradient-to-r from-transparent via-border to-transparent',
      'mx-auto my-16 w-1/2',
      className,
    )}
    {...props}
  >
    {/* ... */}
  </hr>
);

// 图片组件 - 响应式和圆角设计
export const Img = ({ className, alt, ...props }: any) => (
  <img
    className={cn(
      'mb-8 h-auto max-w-full rounded-lg shadow-sm',
      'border border-border',
      className,
    )}
    alt={alt}
    {...props}
  />
);

// 表格组件
export const Table = ({ children, className, ...props }: any) => (
  <div className="mb-8 overflow-x-auto">
    <table
      className={cn(
        'w-full border-collapse',
        'bg-background',
        'rounded-lg border border-border',
        'shadow-sm',
        className,
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
      'border-b border-border px-4 py-3',
      'text-left font-semibold text-foreground',
      'bg-muted',
      className,
    )}
    {...props}
  >
    {children}
  </th>
);

export const TD = ({ children, className, ...props }: any) => (
  <td
    className={cn(
      'border-b border-border px-4 py-3',
      'text-foreground/90',
      className,
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

export const Callout = ({
  type = 'info',
  children,
  title,
  className,
}: CalloutProps) => {
  const typeStyles = {
    info: 'bg-muted border-border text-foreground',
    warning: 'bg-muted border-border text-foreground',
    error: 'bg-foreground text-background border-foreground',
    success: 'bg-background border-foreground text-foreground',
    note: 'bg-muted/50 border-border text-foreground',
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
        'relative mb-8 rounded-lg border p-5',
        typeStyles[type],
        className,
      )}
    >
      {title && (
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <span>{icons[type]}</span>
          <span>{title}</span>
        </div>
      )}
      <div className="prose prose-lg max-w-none leading-8">{children}</div>
    </div>
  );
};

// 代码组 - 用于展示多个相关的代码示例
interface CodeGroupProps {
  children: ReactNode;
  titles?: string[];
  className?: string;
}

export const CodeGroup = ({
  children,
  titles = [],
  className,
}: CodeGroupProps) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className={cn('mb-8', className)}>
      {titles.length > 0 && (
        <div className="mb-0 flex border-b border-border">
          {titles.map((title, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={cn(
                'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activeTab === index
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {title}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        {/* @ts-ignore */}
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
  hr: HR,
  img: Img,
  table: Table,
  th: TH,
  td: TD,
  // 特殊组件
  Callout,
  CodeGroup,
};
