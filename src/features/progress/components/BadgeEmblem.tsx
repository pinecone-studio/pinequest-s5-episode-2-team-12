// Badge seal (ported from prototype/src/components/Badge.tsx, colors as theme tokens).
import type { ReactNode } from 'react';
import type { Badge, BadgeGlyph } from '@/types';

const GLYPH: Record<BadgeGlyph, ReactNode> = {
  eq: (
    <g>
      <path d="M-14 -5 H14 M-14 5 H14" />
      <circle cx={-20} cy={-14} r={2.5} fill="currentColor" stroke="none" />
    </g>
  ),
  book: (
    <path d="M0 -12 C-6 -15 -12 -15 -18 -12 V12 C-12 9 -6 9 0 12 C6 9 12 9 18 12 V-12 C12 -15 6 -15 0 -12 Z M0 -12 V12" />
  ),
  lens: (
    <g>
      <circle cx={-3} cy={-3} r={10} />
      <path d="M4 4 L15 15" />
      <path d="M-9 0 Q-3 -9 3 -4" />
    </g>
  ),
  cross: (
    <g>
      <path d="M-17 12 L15 -12 M-17 -8 L15 10" />
      <circle cx={-1} cy={1} r={3.5} fill="currentColor" stroke="none" />
    </g>
  ),
  cursor: <path d="M-10 -14 L12 2 L2 4 L7 15 L2 17 L-3 6 L-10 12 Z" />,
  crown: <path d="M-16 10 L-18 -10 L-7 -1 L0 -14 L7 -1 L18 -10 L16 10 Z" />,
  compass: (
    <g>
      <circle r={15} />
      <path d="M6 -6 L-3 -3 L-6 6 L3 3 Z" fill="currentColor" />
    </g>
  ),
  flame: <path d="M0 -16 C8 -6 14 0 12 8 C10 15 -10 15 -12 8 C-14 0 -6 -4 -2 -10 C0 -4 2 -2 4 -2" />,
  mend: (
    <g>
      <path d="M-14 6 C-14 -10 14 -10 14 6" />
      <path d="M-8 -4 L-4 2 M0 -6 L0 1 M8 -4 L4 2" />
      <path d="M-16 6 H16" />
    </g>
  ),
  clock: (
    <g>
      <circle r={15} />
      <path d="M0 -9 V0 L7 5" />
    </g>
  ),
  map: (
    <g>
      <path d="M-16 -10 L-6 -14 L6 -10 L16 -14 V10 L6 14 L-6 10 L-16 14 Z" />
      <path d="M-6 -14 V10 M6 -10 V14" />
    </g>
  ),
  flag: (
    <g>
      <path d="M-10 16 V-16" />
      <path d="M-10 -14 C-2 -18 4 -10 14 -14 V2 C4 6 -2 -2 -10 2" />
    </g>
  ),
};

function seal(): string {
  return `${Array.from({ length: 24 })
    .map((_, i) => {
      const a = (i / 24) * Math.PI * 2;
      const r = i % 2 ? 44 : 47;
      return `${i ? 'L' : 'M'}${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
    })
    .join(' ')}Z`;
}
const SEAL = seal();

export function BadgeEmblem({ badge, earned, size = 88 }: { badge: Badge; earned: boolean; size?: number }) {
  const ink = earned ? 'var(--c-on-forest)' : 'var(--c-ink-3)';
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id={`badge-${badge.id}`}>
          <circle r={40} />
        </clipPath>
      </defs>
      <path
        d={SEAL}
        style={{
          fill: earned ? 'var(--c-lime-2)' : 'var(--c-paper-2)',
          stroke: earned ? 'none' : 'var(--c-line-2)',
        }}
        strokeDasharray={earned ? undefined : '3 3'}
      />
      <circle r={38} style={{ fill: earned ? 'var(--c-forest)' : 'var(--c-paper)' }} />
      <circle
        r={33}
        fill="none"
        style={{ stroke: earned ? 'var(--c-moss)' : 'var(--c-line)' }}
        strokeWidth={1}
      />
      {earned && (
        <g clipPath={`url(#badge-${badge.id})`}>
          <path
            d="M-60 30 C-20 10 20 40 60 20 V60 H-60 Z"
            style={{ fill: 'var(--c-leaf-2)' }}
            opacity={0.55}
          />
        </g>
      )}
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: ink }}
      >
        {GLYPH[badge.glyph]}
      </g>
    </svg>
  );
}
