'use client';
import { motion } from 'framer-motion';
import { type ReactNode, useEffect, useRef, useState } from 'react';

/**
 * Animates its height when the content resizes (e.g. Sign Up adds fields).
 * Overflow is clipped only while animating, with a clip margin so glows keep bleeding past the edge.
 */
export function AnimatedHeight({ children }: { children: ReactNode }) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const el = innerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onAnimationStart={() => setAnimating(true)}
      onAnimationComplete={() => setAnimating(false)}
      style={{ overflow: animating ? 'clip' : 'visible', overflowClipMargin: 28 }}
    >
      <div ref={innerRef}>{children}</div>
    </motion.div>
  );
}
