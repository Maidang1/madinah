import {
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { ShineBorder } from "./shine-border";

interface MagicControlFrameProps {
  children: ReactNode;
  className?: string;
}

function MagicControlFrame({ children, className }: MagicControlFrameProps) {
  return (
    <span className={cn("magic-control-frame", className)}>
      <ShineBorder
        className="magic-control-shine"
        duration={16}
        shineColor={[
          "rgba(255, 255, 255, 0.03)",
          "rgba(146, 186, 255, 0.35)",
          "rgba(255, 255, 255, 0.18)",
        ]}
      />
      {children}
    </span>
  );
}

export function MagicInput({
  className,
  ...props
}: ComponentPropsWithoutRef<"input">) {
  return (
    <MagicControlFrame>
      <input className={cn("magic-control-input", className)} {...props} />
    </MagicControlFrame>
  );
}

export function MagicTextarea({
  className,
  ...props
}: ComponentPropsWithoutRef<"textarea">) {
  return (
    <MagicControlFrame className="is-textarea">
      <textarea className={cn("magic-control-input", className)} {...props} />
    </MagicControlFrame>
  );
}

export function MagicSelect({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"select">) {
  return (
    <MagicControlFrame className="is-select">
      <select className={cn("magic-control-input", className)} {...props}>
        {children}
      </select>
      <ChevronDown
        className="magic-control-select-icon"
        size={14}
        aria-hidden="true"
      />
    </MagicControlFrame>
  );
}

export function MagicButton({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"button">) {
  return (
    <button className={cn("magic-button", className)} {...props}>
      <ShineBorder
        className="magic-button-shine"
        duration={14}
        shineColor={[
          "rgba(255, 255, 255, 0.04)",
          "rgba(146, 186, 255, 0.38)",
          "rgba(255, 255, 255, 0.2)",
        ]}
      />
      <span>{children}</span>
    </button>
  );
}
