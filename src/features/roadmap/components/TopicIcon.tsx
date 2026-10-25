// Line glyph per roadmap topic (24×24, currentColor), same style as components/shell/icons.
import type { ReactNode } from 'react';

const G: Record<string, ReactNode> = {
  eq: <path d="M5 9h14M5 15h14" />,
  slope: (
    <>
      <path d="M4 20 20 4" />
      <path d="M9 15h6v-6" />
    </>
  ),
  line: (
    <>
      <path d="M4 4v16h16" />
      <path d="M6 17 19 7" />
    </>
  ),
  system: (
    <>
      <path d="M4 18 20 6M4 7l16 10" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </>
  ),
  parallel: <path d="M4 15 15 4M9 20 20 9" />,
  ineq: (
    <>
      <path d="M15 5 7 12l8 7" />
      <path d="M6 21h11" />
    </>
  ),
  ratio: (
    <>
      <circle cx="7" cy="8" r="2.2" />
      <circle cx="17" cy="16" r="2.2" />
      <path d="M18 5 6 19" />
    </>
  ),
  unit: (
    <>
      <path d="M3 9h18v6H3z" />
      <path d="M7 9v3M11 9v4M15 9v3M19 9v4" />
    </>
  ),
  percent: (
    <>
      <circle cx="7" cy="7" r="2.5" />
      <circle cx="17" cy="17" r="2.5" />
      <path d="M19 5 5 19" />
    </>
  ),
  bars: <path d="M5 20V12M10 20V6M15 20v-9M20 20v-4M3 20h18" />,
  scatter: (
    <>
      <path d="M4 4v16h16" />
      <path d="M8 15h.01M11 12h.01M10 16h.01M14 10h.01M16 11h.01M18 7h.01" strokeWidth={3} />
    </>
  ),
  dice: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M8.5 8.5h.01M15.5 15.5h.01M12 12h.01" strokeWidth={3} />
    </>
  ),
  sample: (
    <>
      <circle cx="10" cy="10" r="6" />
      <path d="m14.5 14.5 5 5" />
      <path d="M8 10h4" />
    </>
  ),
  claim: (
    <>
      <path d="M6 3.5h9l3 3V20.5H6z" />
      <path d="m9 13 2 2 4-4" />
    </>
  ),
  poly: <path d="M3 17c3-12 6-12 9-5s6 7 9-5" />,
  power: (
    <>
      <path d="M5 19 10 9l5 10" />
      <path d="M15 5h4l-4 4h4" />
    </>
  ),
  quad: (
    <>
      <path d="M4 5c3 15 13 15 16 0" />
      <path d="M3 13h18" />
    </>
  ),
  cross: (
    <>
      <path d="M4 6c4 14 12 14 16 0" />
      <path d="M3 17 21 9" />
    </>
  ),
  parabola: (
    <>
      <path d="M4 18C7 4 17 4 20 18" />
      <path d="M12 8v12" strokeDasharray="2 2.5" />
    </>
  ),
  exp: (
    <>
      <path d="M4 4v16h16" />
      <path d="M6 18c6 0 9-2 12-12" />
    </>
  ),
  shift: (
    <>
      <path d="M3 17c2-8 4-8 6 0" />
      <path d="M13 13c2-8 4-8 6 0" />
      <path d="M8 6h7m-2-2 2 2-2 2" />
    </>
  ),
  angle: (
    <>
      <path d="M4 19h16L9 5z" />
      <path d="M8 19a4 4 0 0 0-1-3" />
    </>
  ),
  right: (
    <>
      <path d="M5 19V5l14 14z" />
      <path d="M5 15h4v4" />
    </>
  ),
  trig: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12 17.5 6.5M12 12h5.5" />
    </>
  ),
  circle: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12V4a8 8 0 0 1 7 4z" fill="currentColor" fillOpacity=".25" />
    </>
  ),
  cube: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </>
  ),
};

export function TopicIcon({
  name,
  size = 22,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {G[name] ?? G.eq}
    </svg>
  );
}

export function LockIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9.5" rx="2.5" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      aria-hidden="true"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StarRow({ stars, size = 14 }: { stars: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3.5 14.4 9l5.6.5-4.3 3.7 1.3 5.6L12 15.9l-5 2.9 1.3-5.6L4 9.5 9.6 9z"
            fill={i <= stars ? 'var(--c-gold)' : 'var(--c-line-2)'}
          />
        </svg>
      ))}
    </span>
  );
}
