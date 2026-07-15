import {
  useCallback,
  useRef,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type UIEvent,
} from "react";
import { OverlayScrollbar } from "./overlay-scrollbar";
import type { OverlayScrollbarRef } from "./overlay-scrollbar";

interface ScrollFadeProps extends Omit<HTMLAttributes<HTMLDivElement>, "onScroll"> {
  axis?: "vertical" | "horizontal";
  fadeSize?: string;
  alwaysFade?: boolean;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
  onScroll?: (event: UIEvent<HTMLDivElement>) => void;
}

export function ScrollFade({
  axis = "vertical",
  fadeSize = "24px",
  alwaysFade = false,
  className,
  style,
  onScroll: onScrollProp,
  ref,
  children,
  ...rest
}: ScrollFadeProps) {
  const scrolledStartRef = useRef(false);
  const scrolledEndRef = useRef(false);
  const osRef = useRef<OverlayScrollbarRef | null>(null);

  const direction = axis === "vertical" ? "bottom" : "right";

  const updateMask = useCallback(() => {
    const el = osRef.current?.getElement();
    if (!el) return;

    let scrolledStart = false;
    let scrolledEnd = false;

    if (axis === "vertical") {
      scrolledStart = el.scrollTop > 4;
      scrolledEnd = el.scrollHeight - el.scrollTop - el.clientHeight > 4;
    } else {
      scrolledStart = el.scrollLeft > 4;
      scrolledEnd = el.scrollWidth - el.scrollLeft - el.clientWidth > 4;
    }

    if (scrolledStart === scrolledStartRef.current && scrolledEnd === scrolledEndRef.current) {
      return;
    }
    scrolledStartRef.current = scrolledStart;
    scrolledEndRef.current = scrolledEnd;

    const showStart = alwaysFade || scrolledStart;
    const showEnd = alwaysFade || scrolledEnd;
    const maskImage = `linear-gradient(to ${direction}, ${
      showStart ? `transparent, black ${fadeSize},` : "black,"
    } ${showEnd ? `black calc(100% - ${fadeSize}), transparent` : "black"})`;

    el.style.maskImage = maskImage;
    (el.style as { WebkitMaskImage?: string }).WebkitMaskImage = maskImage;
  }, [axis, direction, fadeSize, alwaysFade]);

  const handleScroll = useCallback(
    (event: Event) => {
      updateMask();
      onScrollProp?.(event as unknown as UIEvent<HTMLDivElement>);
    },
    [onScrollProp, updateMask],
  );

  const setRefs = useCallback(
    (os: OverlayScrollbarRef | null) => {
      osRef.current = os;
      const el = os?.getElement() ?? null;

      if (typeof ref === "function") {
        ref(el);
      } else if (ref) {
        (ref as { current: HTMLDivElement | null }).current = el;
      }

      if (el) {
        requestAnimationFrame(() => updateMask());
      }
    },
    [ref, updateMask],
  );

  return (
    <OverlayScrollbar
      ref={setRefs}
      direction={axis}
      className={className}
      style={style}
      onScroll={handleScroll}
      {...(rest as Record<string, unknown>)}
    >
      {children}
    </OverlayScrollbar>
  );
}
