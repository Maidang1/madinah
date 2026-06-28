import {
  Children,
  memo,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  AnimatePresence,
  motion,
  type MotionProps,
  useReducedMotion,
} from "motion/react";
import { cn } from "../../lib/cn";

export function AnimatedListItem({ children }: { children: ReactNode }) {
  const shouldReduceMotion = useReducedMotion();
  const animations: MotionProps = shouldReduceMotion
    ? {
        initial: false,
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.01 },
      }
    : {
        initial: { scale: 0.98, opacity: 0, y: 6 },
        animate: { scale: 1, opacity: 1, y: 0 },
        exit: { scale: 0.98, opacity: 0, y: -4 },
        transition: { type: "spring", stiffness: 350, damping: 40 },
      };

  return (
    <motion.div {...animations} layout className="magic-animated-list-item">
      {children}
    </motion.div>
  );
}

export interface AnimatedListProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  delay?: number;
}

export const AnimatedList = memo(function AnimatedList({
  children,
  className,
  delay = 1000,
  ...props
}: AnimatedListProps) {
  const shouldReduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const childrenArray = useMemo(() => Children.toArray(children), [children]);

  useEffect(() => {
    if (shouldReduceMotion) {
      setIndex(Math.max(0, childrenArray.length - 1));
      return;
    }

    if (index >= childrenArray.length - 1) return;

    const timeout = window.setTimeout(() => {
      setIndex((current) => current + 1);
    }, delay);

    return () => window.clearTimeout(timeout);
  }, [childrenArray.length, delay, index, shouldReduceMotion]);

  const itemsToShow = useMemo(
    () => childrenArray.slice(0, Math.min(index + 1, childrenArray.length)),
    [childrenArray, index],
  );

  return (
    <div className={cn("magic-animated-list", className)} {...props}>
      <AnimatePresence initial={false}>
        {itemsToShow.map((item) => (
          <AnimatedListItem key={(item as ReactElement).key}>
            {item}
          </AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  );
});
