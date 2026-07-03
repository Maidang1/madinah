import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface ShineBorderProps extends HTMLAttributes<HTMLDivElement> {
  borderWidth?: number;
  duration?: number;
  shineColor?: string | string[];
}

export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  shineColor = "rgba(255, 255, 255, 0.28)",
  className,
  style,
  ...props
}: ShineBorderProps) {
  const colors = Array.isArray(shineColor) ? shineColor.join(",") : shineColor;

  return (
    <div
      style={
        {
          "--border-width": `${borderWidth}px`,
          "--duration": `${duration}s`,
          backgroundImage: `radial-gradient(transparent, transparent, ${colors}, transparent, transparent)`,
          backgroundSize: "300% 300%",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMask:
            "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          padding: "var(--border-width)",
          ...style,
        } as CSSProperties
      }
      className={cn("magic-shine-border", className)}
      {...props}
    />
  );
}
