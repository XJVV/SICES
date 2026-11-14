"use client";

import * as React from "react";

/**
 * Contador animado: interpola de 0 al valor objetivo con easing.
 * Respeta prefers-reduced-motion mostrando el valor final directamente.
 */
export function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        raf = window.requestAnimationFrame(tick);
      }
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
