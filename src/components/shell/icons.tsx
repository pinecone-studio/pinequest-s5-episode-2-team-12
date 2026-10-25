// Line icons for the app shell (24×24, 1.8 stroke, currentColor).
import type { ReactNode, SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: P & { children: ReactNode }) {
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
      {...rest}
    >
      {children}
    </svg>
  );
}

const PATHS: Record<string, ReactNode> = {
  dashboard: <path d="M3.5 10.5 12 4l8.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-4v-6h-6v6H5A1.5 1.5 0 0 1 3.5 19z" />,
  journey: (
    <>
      <path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M13 4h5.5c.8 0 1.5.7 1.5 1.5v13c0 .8-.7 1.5-1.5 1.5H13z" />
      <path d="M6.5 8h2M6.5 11h2M15.5 8h2M15.5 11h2" />
    </>
  ),
  roadmap: (
    <>
      <path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z" />
      <path d="M9 4.5v13M15 6.5v13" />
    </>
  ),
  desmos: (
    <>
      <path d="M4 4v16h16" />
      <path d="M7 16c2-6 4-9 6-9s3 4 6 2" />
    </>
  ),
  practicePlayer: (
    <>
      <path d="m15.5 4.5 4 4L9 19H5v-4z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  bank: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="2.8" />
      <path d="M5 6v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6" />
      <path d="M5 12v6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8v-6" />
    </>
  ),
  hard: <path d="M12 3.5 14.4 9l5.6.5-4.3 3.7 1.3 5.6L12 15.9l-5 2.9 1.3-5.6L4 9.5 9.6 9z" />,
  mock: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9v4l2.5 2M9.5 2.5h5" />
    </>
  ),
  mistakes: (
    <>
      <path d="M6 3.5h9l4 4v13H6z" />
      <path d="M14.5 3.5v4.5H19M9.5 12.5l4 4M13.5 12.5l-4 4" />
    </>
  ),
  cards: (
    <>
      <rect x="3.5" y="6.5" width="12" height="14" rx="2" />
      <path d="M8 3.5h10.5a2 2 0 0 1 2 2V17" />
    </>
  ),
  tutor: (
    <>
      <path d="M4.5 5.5h15v10h-8l-4.5 4v-4h-2.5z" />
      <path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01" />
    </>
  ),
  planner: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4M8 14h3" />
    </>
  ),
  league: (
    <>
      <path d="M7.5 4h9v5a4.5 4.5 0 0 1-9 0z" />
      <path d="M7.5 6H4.5c0 3 1.5 4.5 3.3 4.8M16.5 6h3c0 3-1.5 4.5-3.3 4.8M12 13.5V17M8.5 20.5h7M9.5 17h5v3.5h-5z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8h.01" />
    </>
  ),
  progress: <path d="M5 20V13M10 20V8M15 20v-5M20 20V4" />,
  achievements: (
    <>
      <circle cx="12" cy="9" r="5.5" />
      <path d="m8.8 13.5-1.3 7 4.5-2.5 4.5 2.5-1.3-7" />
    </>
  ),
  more: (
    <>
      <circle cx="5.5" cy="12" r="1.2" />
      <circle cx="12" cy="12" r="1.2" />
      <circle cx="18.5" cy="12" r="1.2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  play: <path d="M8 5.5v13l10-6.5z" fill="currentColor" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
};

export function Icon({ name, ...rest }: P & { name: string }) {
  return <Svg {...rest}>{PATHS[name] ?? PATHS.dashboard}</Svg>;
}

/** Filled flame for the streak counter. */
export function Flame({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5c.6 3.2 4.8 5.3 5.6 9.4.9 4.6-2.4 9.6-5.6 9.6s-6.6-2.4-6.6-7c0-3 1.8-4.6 3-6 .3 1.8.8 3 2 3.7-.4-3.6.4-6.9 1.6-9.7z"
        fill="#f59e0b"
      />
      <path
        d="M12 12c.4 1.8 2.7 2.9 2.7 5.2 0 2-1.3 3.3-2.7 3.3s-2.8-1.2-2.8-3c0-1.6 1.5-2.6 2.8-5.5z"
        fill="#fde047"
      />
    </svg>
  );
}

/** Green gem for XP. */
export function Gem({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3.5h10l4 5.5-9 11.5L3 9z" fill="#22c55e" />
      <path d="M3 9h18l-9 11.5z" fill="#15803d" />
      <path d="M7 3.5 9.5 9 12 3.5 14.5 9 17 3.5" fill="none" stroke="#bbf7d0" strokeWidth={1} />
      <path d="M9.5 9 12 20.5 14.5 9" fill="#16a34a" />
    </svg>
  );
}
