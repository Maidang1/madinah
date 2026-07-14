import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import type { OverlayScrollbarsComponentRef } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";
import "./overlay-scrollbar.css";

export interface OverlayScrollbarProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** 滚动方向，默认垂直 */
  direction?: "vertical" | "horizontal" | "both";
  /** 自动隐藏滚动条行为 */
  autoHide?: "never" | "scroll" | "move" | "leave";
  /** 滚动条是否可见 */
  visibility?: "visible" | "hidden" | "auto";
  onScroll?: (event: Event) => void;
}

export interface OverlayScrollbarRef {
  /** 获取底层 DOM 元素（视口元素） */
  getElement: () => HTMLDivElement | null;
  /** 获取 OverlayScrollbars 实例 */
  getInstance: () => ReturnType<OverlayScrollbarsComponentRef["osInstance"]>;
  /** 滚动到指定位置 */
  scrollTo: (options: ScrollToOptions) => void;
}

export const OverlayScrollbar = forwardRef<OverlayScrollbarRef, OverlayScrollbarProps>(
  function OverlayScrollbar(
    {
      children,
      className,
      style,
      direction = "vertical",
      autoHide = "move",
      visibility = "auto",
      onScroll,
    },
    ref,
  ) {
    const osRef = useRef<OverlayScrollbarsComponentRef<"div"> | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);

    const setViewportRef = useCallback((el: HTMLDivElement | null) => {
      viewportRef.current = el;
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        getElement: () => viewportRef.current,
        getInstance: () => osRef.current?.osInstance() ?? null,
        scrollTo: (options: ScrollToOptions) => {
          viewportRef.current?.scrollTo(options);
        },
      }),
      [],
    );

    const options = {
      scrollbars: {
        theme: "os-theme-writer",
        visibility,
        autoHide,
        autoHideDelay: 300,
        autoHideSuspend: true,
        dragScroll: true,
        clickScroll: true,
      },
      overflow: {
        x: direction === "vertical" ? ("hidden" as const) : ("scroll" as const),
        y: direction === "horizontal" ? ("hidden" as const) : ("scroll" as const),
      },
    };

    const events = onScroll
      ? {
          scroll: (_instance: unknown, event: Event) => {
            onScroll(event);
          },
        }
      : undefined;

    useEffect(() => {
      const os = osRef.current;
      if (!os) return;
      const el = os.getElement() as HTMLElement | null;
      if (!el) return;
      const viewport = el.querySelector(".os-viewport") as HTMLDivElement | null;
      if (viewport) {
        setViewportRef(viewport);
      }
    }, []);

    return (
      <OverlayScrollbarsComponent
        ref={osRef}
        options={options}
        events={events}
        className={className}
        style={style}
      >
        {children}
      </OverlayScrollbarsComponent>
    );
  },
);
