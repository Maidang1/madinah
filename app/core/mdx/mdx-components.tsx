import { ReactNode, useState } from 'react';
import { cn } from '~/core/utils';
import { Heading2, Heading3, Heading4, Heading5, Heading6 } from 'lucide-react';

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
      'text-text-strong',
      'leading-tight tracking-tight',
      'border-border-weak border-b pb-4',
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
      'text-text-strong',
      'leading-snug tracking-tight',
      'group heading-group relative',
      'flex items-center gap-1',
      className,
    )}
    {...props}
  >
    {children}
    <Heading2 className="text-text-weak text-2xl opacity-0 transition-opacity group-hover:opacity-100" />
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
      'text-text-strong',
      'tracking-tight',
      'group heading-group relative',
      'flex items-center gap-1',
      className,
    )}
    {...props}
  >
    {children}
    <Heading3 className="text-text-weak text-xl opacity-0 transition-opacity group-hover:opacity-100" />
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
      'text-text-strong',
      'tracking-tight',
      'group heading-group',
      'flex items-center gap-1',
      className,
    )}
    {...props}
  >
    {children}
    <Heading4 className="text-text-weak text-lg opacity-0 transition-opacity group-hover:opacity-100" />
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
      'text-text-strong',
      'group heading-group',
      'flex items-center gap-1',
      className,
    )}
    {...props}
  >
    {children}
    <Heading5 className="text-text-weak text-base opacity-0 transition-opacity group-hover:opacity-100" />
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
      'text-text-strong/80',
      'tracking-wider uppercase',
      'group heading-group',
      'flex items-center gap-1',
      className,
    )}
    {...props}
  >
    {children}
    <Heading6 className="text-text-weak text-sm opacity-0 transition-opacity group-hover:opacity-100" />
  </h6>
);

export const P = ({ children, className, ...props }: ParagraphProps & any) => (
  <p
    className={cn(
      'mb-2 text-[14px] leading-8',
      'text-text-strong/90',
      'font-normal',
      className,
    )}
    {...props}
  >
    {children}
  </p>
);

export const A = ({ children, href, className, ...props }: LinkProps & any) => {
  const isExternal = href?.startsWith('http') || href?.startsWith('//');
  const isEmail = href?.startsWith('mailto:');

  return (
    <a
      href={href}
      className={cn(
        'text-text-strong',
        'decoration-text-weak/30 decoration-1 underline-offset-4',
        'hover:decoration-text-strong hover:decoration-2',
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

export const UL = ({ children, className, ...props }: ListProps & any) => (
  <ul
    className={cn(
      'mb-2 list-none space-y-3 pl-0',
      'text-text-strong/90',
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
      'text-text-strong/90',
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
      'before:text-text-weak/40 before:absolute before:left-0 before:font-bold before:content-["•"]',
      '[ol_&]:before:content-none',
      className,
    )}
    {...props}
  >
    {children}
  </li>
);

export const Blockquote = ({
  children,
  className,
  ...props
}: BlockquoteProps & any) => (
  <blockquote
    className={cn(
      'border-border-weak mb-8 border-l-4 py-3 pl-6',
      'bg-surface-flat-base-hover',
      'text-text-strong/80 italic',
      'text-xl leading-relaxed font-medium',
      className,
    )}
    {...props}
  >
    {children}
  </blockquote>
);

export const Code = ({ children, className, ...props }: CodeProps & any) => {
  const isInPre =
    className?.includes('code-container') || props['data-language'];

  if (isInPre) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  return (
    <code
      className={cn(
        'rounded border-0 px-1.5 py-0.5 font-mono text-sm',
        'bg-surface-flat-base-hover text-text-strong',
        'border-border-weak border whitespace-nowrap',
        className,
      )}
      {...props}
    >
      {children}
    </code>
  );
};

export const HR = ({ className, ...props }: any) => (
  <hr
    className={cn(
      'via-border-weak h-px border-none bg-gradient-to-r from-transparent to-transparent',
      'mx-auto my-16 w-1/2',
      className,
    )}
    {...props}
  ></hr>
);

export const Img = ({ className, alt, ...props }: any) => (
  <img
    className={cn(
      'mb-8 h-auto max-w-full rounded-lg shadow-sm',
      'border-border-weak border',
      className,
    )}
    alt={alt}
    {...props}
  />
);

export const Table = ({ children, className, ...props }: any) => (
  <div className="mb-8 overflow-x-auto">
    <table
      className={cn(
        'w-full border-collapse',
        'bg-surface-raised-base',
        'border-border-weak rounded-lg border',
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
      'border-border-weak border-b px-4 py-3',
      'text-text-strong text-left font-semibold',
      'bg-surface-flat-base-hover',
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
      'border-border-weak border-b px-4 py-3',
      'text-text-strong/90',
      className,
    )}
    {...props}
  >
    {children}
  </td>
);

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
    info: 'bg-surface-flat-base-hover border-border-weak text-text-strong',
    warning: 'bg-surface-flat-base-hover border-border-weak text-text-strong',
    error: 'bg-text-strong text-surface-raised-base border-text-strong',
    success: 'bg-surface-raised-base border-text-strong text-text-strong',
    note: 'bg-surface-flat-base-hover/50 border-border-weak text-text-strong',
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
        <div className="border-border-weak mb-0 flex border-b">
          {titles.map((title, index) => (
            <button
              key={index}
              onClick={() => setActiveTab(index)}
              className={cn(
                'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                activeTab === index
                  ? 'border-text-strong text-text-strong'
                  : 'text-text-weak hover:text-text-strong border-transparent',
              )}
            >
              {title}
            </button>
          ))}
        </div>
      )}
      <div className="relative">
        {Array.isArray(children)
          ? (children[activeTab] as ReactNode)
          : children}
      </div>
    </div>
  );
};

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
  Callout,
  CodeGroup,
};
