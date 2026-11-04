'use client';
// Seconds since `active` became true (0 while inactive). Suu on one iMac can take 10–30 s for a Desmos lesson;
// a ticking counter shows the page is working, not frozen.
import { useEffect, useState } from 'react';

export function useElapsed(active: boolean): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    setS(0);
    if (!active) return;
    const t0 = Date.now();
    const id = setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);
  return s;
}

/** "12 сек" once a wait is long enough to notice (≥ 3 s), otherwise nothing. */
export function waitLabel(seconds: number, unit: string): string {
  return seconds >= 3 ? ` ${seconds} ${unit}` : '';
}
