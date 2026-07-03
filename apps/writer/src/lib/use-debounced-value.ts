import { useEffect, useState } from "react";

/**
 * Returns a value that trails `value` by `delayMs`. Used to keep expensive
 * derived computations (metrics, TOC, search indexes) off the keystroke path.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (Object.is(debounced, value)) return;

    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [debounced, delayMs, value]);

  return debounced;
}
