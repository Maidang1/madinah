import { createElement, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "../lib/cn";

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

function createHeading(Tag: HeadingTag) {
  return function Heading({
    className,
    children,
    ...props
  }: ComponentPropsWithoutRef<HeadingTag>) {
    return createElement(
      Tag,
      { ...props, className: cn("heading-group", className) },
      children,
    );
  };
}

function Passthrough<Tag extends keyof HTMLElementTagNameMap>(Tag: Tag) {
  return function Component({
    className,
    children,
    ...props
  }: ComponentPropsWithoutRef<Tag>) {
    return createElement(
      Tag,
      { ...props, className: cn(className) },
      children,
    );
  };
}

function Anchor({
  className,
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"a">) {
  const isExternal = href?.startsWith("http") || href?.startsWith("//");

  return (
    <a
      href={href}
      className={cn(className)}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      {...props}
    >
      {children}
    </a>
  );
}

function Table({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"table">) {
  return (
    <div className="table-wrapper">
      <table className={cn(className)} {...props}>
        {children}
      </table>
    </div>
  );
}

interface CalloutProps {
  type?: "info" | "warning" | "error" | "success" | "note";
  title?: string;
  className?: string;
  children?: ReactNode;
}

function Callout({ title, className, children }: CalloutProps) {
  return (
    <div className={cn("callout", className)}>
      {title ? <div className="callout-title">{title}</div> : null}
      <div>{children}</div>
    </div>
  );
}

export const mdxComponents = {
  h1: createHeading("h1"),
  h2: createHeading("h2"),
  h3: createHeading("h3"),
  h4: createHeading("h4"),
  h5: createHeading("h5"),
  h6: createHeading("h6"),
  p: Passthrough("p"),
  a: Anchor,
  ul: Passthrough("ul"),
  ol: Passthrough("ol"),
  li: Passthrough("li"),
  blockquote: Passthrough("blockquote"),
  code: Passthrough("code"),
  hr: Passthrough("hr"),
  img: Passthrough("img"),
  table: Table,
  th: Passthrough("th"),
  td: Passthrough("td"),
  Callout,
};
