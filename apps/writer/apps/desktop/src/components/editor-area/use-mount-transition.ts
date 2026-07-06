import { useEffect, useState } from "react";

export interface MountTransition {
  shouldRender: boolean;
  phase: "open" | "closed";
}

export function useMountTransition(active: boolean, durationMs: number): MountTransition {
  const [shouldRender, setShouldRender] = useState(false);
  const [phase, setPhase] = useState<"open" | "closed">("closed");

  // rAF/setTimeout-driven enter/exit mount transition; each run does at most one synchronous setState, the rest are deferred to separate paints.
  // eslint-disable-next-line react-doctor/no-cascading-set-state
  useEffect(() => {
    if (active) {
      // Timer/frame-driven transition side effect, not prop mirroring; deriving during render would lose the next-frame open phase.
      // eslint-disable-next-line react-doctor/no-adjust-state-on-prop-change
      setShouldRender(true);
      const frame = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(frame);
    }
    // Timer-driven delayed unmount (setTimeout); cannot be derived during render without losing the close animation.
    // eslint-disable-next-line react-doctor/no-adjust-state-on-prop-change
    setPhase("closed");
    const timer = window.setTimeout(() => setShouldRender(false), durationMs);
    return () => clearTimeout(timer);
  }, [active, durationMs]);

  return { shouldRender, phase };
}
