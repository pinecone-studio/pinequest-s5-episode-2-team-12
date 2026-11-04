'use client';
// The map cat's speech bubble doubles as a guidebook: short tips on how the site works, one at a time.
// They rotate on their own; tapping the bubble skips to the next one.
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n-client';

export const GUIDE_TIPS = 8;
const EVERY_MS = 6500;

export function CatGuide() {
  const t = useT('roadmap');
  const [tip, setTip] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: restart the timer after a tap so a new tip gets its full time
  useEffect(() => {
    const id = setInterval(() => setTip((i) => (i + 1) % GUIDE_TIPS), EVERY_MS);
    return () => clearInterval(id);
  }, [tip]);

  return (
    <button
      type="button"
      className="roadmap-cat-message"
      aria-label={t('catGuide.next')}
      aria-live="polite"
      // the map pans on pointerdown; a tap on the bubble is not a drag
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => setTip((i) => (i + 1) % GUIDE_TIPS)}
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 'calc(100% + 8px * var(--inv, 1))',
        transform: 'translateX(-50%)',
        width: 'calc(174px * var(--inv, 1))',
        height: 'calc(87px * var(--inv, 1))',
        display: 'grid',
        placeItems: 'center',
        pointerEvents: 'auto',
        cursor: 'pointer',
        background: 'none',
        border: 0,
        padding: 0,
      }}
    >
      <svg
        viewBox="0 0 200 100"
        focusable="false"
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <path
          d="M99 5C151 3 190 7 192 42 197 73 170 83 133 80 129 92 117 97 104 96 114 90 116 86 116 80 72 89 23 86 12 69-8 36 16 8 62 6Z"
          fill="var(--c-paper)"
          stroke="var(--c-ink)"
          strokeWidth="1.8"
        />
      </svg>
      <span
        key={tip}
        style={{
          position: 'relative',
          maxWidth: '78%',
          paddingBottom: 'calc(15px * var(--inv, 1))',
          textAlign: 'center',
          fontSize: 'calc(11px * var(--inv, 1))',
          fontWeight: 700,
          lineHeight: 1.35,
          color: 'var(--c-ink)',
        }}
      >
        {t(`catGuide.tips.${tip}`)}
      </span>
    </button>
  );
}
