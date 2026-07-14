import { forwardRef, type ReactNode } from "react";
import { OverlayScrollbar } from "@/components/overlay-scrollbar";

const FADE_DISTANCE = 120;
const SCROLLBAR_GUTTER = "18px";
const FADE_MASK_VERTICAL = `linear-gradient(to bottom, transparent 5%, black 15%, black 85%, transparent)`;
const FADE_MASK_GUTTER = `linear-gradient(to right, black ${SCROLLBAR_GUTTER}, transparent ${SCROLLBAR_GUTTER}, transparent calc(100% - ${SCROLLBAR_GUTTER}), black calc(100% - ${SCROLLBAR_GUTTER}))`;
const FADE_MASK = `${FADE_MASK_VERTICAL}, ${FADE_MASK_GUTTER}`;

export const EDITOR_SAFE_SCROLL_MARGIN = FADE_DISTANCE + 20;
export const EDITOR_SCROLLBAR_GUTTER = SCROLLBAR_GUTTER;

function ProgressiveBlur({ position }: { position: "top" | "bottom" }) {
  const isTop = position === "top";

  const topFade = `linear-gradient(to bottom, black 40%, transparent 80%)`;
  const bottomFade = `linear-gradient(to top, black 20%, transparent 60%)`;
  return (
    <div
      className="pointer-events-none absolute z-10 h-[120px] left-[18px] right-[18px] [backdrop-filter:blur(3px)] [-webkit-backdrop-filter:blur(3px)]"
      style={{
        [isTop ? "top" : "bottom"]: 0,
        maskImage: isTop ? topFade : bottomFade,
        WebkitMaskImage: isTop ? topFade : bottomFade,
      }}
    />
  );
}

interface EditorScrollContainerProps {
  children: ReactNode;
}

export const EditorScrollContainer = forwardRef<HTMLDivElement, EditorScrollContainerProps>(
  function EditorScrollContainer({ children }, ref) {
    return (
      <div className="relative h-full">
        <OverlayScrollbar
          ref={(osRef) => {
            if (!osRef) {
              if (typeof ref === "function") {
                ref(null);
              } else if (ref) {
                (ref as { current: HTMLDivElement | null }).current = null;
              }
              return;
            }
            const el = osRef.getElement();
            if (typeof ref === "function") {
              ref(el);
            } else if (ref) {
              (ref as { current: HTMLDivElement | null }).current = el;
            }
          }}
          className="h-full"
          style={{
            maskImage: FADE_MASK,
            WebkitMaskImage: FADE_MASK,
            maskComposite: "add",
            WebkitMaskComposite: "source-over",
            borderTop: "12px solid transparent",
            borderBottom: "12px solid transparent",
            boxSizing: "border-box",
          }}
        >
          {children}
        </OverlayScrollbar>
        <ProgressiveBlur position="top" />
        <ProgressiveBlur position="bottom" />
      </div>
    );
  },
);
