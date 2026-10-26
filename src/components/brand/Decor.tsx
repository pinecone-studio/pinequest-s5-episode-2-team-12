// Brand ornaments lifted from the deck: green brush blob, hand-drawn stars & birds, thin scribble lines.
import type { CSSProperties } from 'react';
import { MascotArt } from './MascotArt';

export function Blob({
  className = '',
  style,
  color = 'var(--c-leaf)',
}: {
  className?: string;
  style?: CSSProperties;
  color?: string;
}) {
  return (
    <svg
      viewBox="0 0 400 260"
      className={className}
      style={style}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path
        d="M30 150 C18 110 60 92 92 70 C130 44 150 30 196 38 C236 44 250 22 296 34 C344 46 382 82 372 128 C364 166 388 196 350 220 C306 246 252 230 210 240 C160 252 120 246 82 228 C44 212 40 184 30 150 Z"
        fill={color}
      />
      <g stroke={color} strokeWidth={7} strokeLinecap="round" opacity={0.85}>
        <path d="M8 120 L70 118" />
        <path d="M300 196 L392 194" />
        <path d="M120 252 L250 250" opacity={0.6} />
      </g>
    </svg>
  );
}

export function Stars({ className = '', style }: { className?: string; style?: CSSProperties }) {
  const star = (x: number, y: number, s: number, filled: boolean, d = 0) => (
    <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        className="twinkle"
        style={{ animationDelay: `${d}s` }}
        d="M0 -10 C1.5 -2 2 -1.5 10 0 C2 1.5 1.5 2 0 10 C-1.5 2 -2 1.5 -10 0 C-2 -1.5 -1.5 -2 0 -10 Z"
        fill={filled ? 'var(--c-ink)' : 'none'}
        stroke="var(--c-ink)"
        strokeWidth={filled ? 0 : 1.4 / s}
      />
    </g>
  );
  return (
    <svg viewBox="0 0 220 140" className={className} style={style} aria-hidden="true">
      {star(30, 70, 1, true, 0)}
      {star(90, 30, 0.7, false, 0.4)}
      {star(150, 50, 1.2, true, 0.8)}
      {star(200, 20, 0.6, false, 1.1)}
      {star(120, 100, 0.8, true, 0.2)}
      {star(185, 105, 0.9, false, 0.6)}
      {star(60, 120, 0.5, true, 1.4)}
      <g stroke="var(--c-ink)" strokeWidth={1.4} fill="none" strokeLinecap="round">
        <path d="M60 88 q5 -5 10 0 q5 -5 10 0" />
        <path d="M168 82 q4 -4 8 0 q4 -4 8 0" />
      </g>
    </svg>
  );
}

export function Scribble({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 600 400" className={className} style={style} aria-hidden="true" fill="none">
      <g stroke="var(--c-ink-3)" strokeOpacity={0.35} strokeWidth={1.1} strokeLinecap="round">
        <path d="M-20 80 C60 20 140 140 220 60 S360 -20 420 70 S520 160 640 90" />
        <path d="M40 380 C80 300 30 240 120 210 S260 260 300 180 S420 120 380 40" />
        <path d="M420 400 C440 320 520 330 540 250 S620 160 560 110" />
      </g>
    </svg>
  );
}

/** The Suprep mark: the black cat icon + spaced SUPREP wordmark. */
export function Logo({
  light = false,
  compact = false,
  tagline,
}: {
  light?: boolean;
  compact?: boolean;
  tagline?: string;
}) {
  return (
    <div className="flex items-center gap-3 select-none">
      <MascotArt size={compact ? 28 : 34} className="logo-cat shrink-0" />
      {!compact && (
        <span className="grid leading-none">
          <span
            className="font-sans font-bold tracking-[0.32em] text-[17px]"
            style={{ color: light ? 'var(--c-on-forest)' : 'var(--c-ink)' }}
          >
            SUPREP
          </span>
          {tagline && (
            <span className="mt-1.5 text-[11px] font-medium tracking-wide text-ink-3">{tagline}</span>
          )}
        </span>
      )}
    </div>
  );
}

/** Large slab wordmark as on the cover slide. */
export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`font-slab font-black tracking-tight ${className}`}>SUPREP</span>;
}
