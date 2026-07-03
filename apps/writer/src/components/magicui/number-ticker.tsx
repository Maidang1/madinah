import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
} from "react";
import {
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { cn } from "../../lib/cn";

interface NumberTickerProps extends ComponentPropsWithoutRef<"span"> {
  value: number;
  startValue?: number;
  direction?: "up" | "down";
  delay?: number;
  decimalPlaces?: number;
}

export function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  className,
  decimalPlaces = 0,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(direction === "down" ? value : startValue);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, { once: true, margin: "0px" });
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isInView) return;

    if (shouldReduceMotion) {
      if (ref.current) {
        ref.current.textContent = formatTickerValue(value, decimalPlaces);
      }
      return;
    }

    const timeout = window.setTimeout(() => {
      motionValue.set(direction === "down" ? startValue : value);
    }, delay * 1000);

    return () => window.clearTimeout(timeout);
  }, [
    decimalPlaces,
    delay,
    direction,
    isInView,
    motionValue,
    shouldReduceMotion,
    startValue,
    value,
  ]);

  useEffect(
    () =>
      springValue.on("change", (latest) => {
        if (!ref.current) return;

        ref.current.textContent = formatTickerValue(latest, decimalPlaces);
      }),
    [decimalPlaces, springValue],
  );

  return (
    <span
      ref={ref}
      className={cn("magic-number-ticker", className)}
      {...props}
    >
      {formatTickerValue(shouldReduceMotion ? value : startValue, decimalPlaces)}
    </span>
  );
}

function formatTickerValue(value: number, decimalPlaces: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(Number(value.toFixed(decimalPlaces)));
}
