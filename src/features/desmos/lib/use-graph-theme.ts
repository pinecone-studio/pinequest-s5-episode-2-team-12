'use client';
import { useEffect, useState } from 'react';

/** Canvas pixels do not react to CSS; observe the same theme sources as the app. */
export function useGraphTheme() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const redraw = () => setVersion((v) => v + 1);
    const observer = new MutationObserver(redraw);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });
    const media = matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', redraw);
    return () => {
      observer.disconnect();
      media.removeEventListener('change', redraw);
    };
  }, []);
  return version;
}
