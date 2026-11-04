'use client';
// Single-series line chart over time (mock scores). 2px line, ≥8px dots with a surface ring, hairline grid
// on clean ticks, value label only on the last point, crosshair tooltip on hover/focus, sr-only table.
import { useId, useState } from 'react';

export type LinePoint = { x: number; y: number; label: string };

const W = 560;
const H = 220;
const PAD = { l: 40, r: 44, t: 16, b: 30 };

export function LineChart({
  points,
  caption,
  yMin,
  yMax,
  yStep,
  color = 'var(--chart-1)',
  formatX,
  formatY = String,
}: {
  points: LinePoint[];
  caption: string;
  yMin: number;
  yMax: number;
  yStep: number;
  color?: string;
  formatX: (x: number) => string;
  formatY?: (y: number) => string;
}) {
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const sx = (x: number) =>
    x1 === x0 ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((x - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const sy = (y: number) => PAD.t + (1 - (y - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const ticks: number[] = [];
  for (let y = yMin; y <= yMax; y += yStep) ticks.push(y);
  const lastIdx = points.length - 1;
  const h = hover === null ? null : points[hover];

  return (
    <figure className="mx-auto grid w-full max-w-[640px] gap-2">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby={`${uid}-cap`}>
          {ticks.map((y) => (
            <g key={y}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={sy(y)}
                y2={sy(y)}
                style={{ stroke: 'var(--chart-grid)' }}
                strokeWidth={1}
              />
              <text
                x={PAD.l - 8}
                y={sy(y)}
                dy="0.35em"
                textAnchor="end"
                className="fill-[var(--c-ink-3)] text-[11px] tnum"
              >
                {formatY(y)}
              </text>
            </g>
          ))}
          {points.length > 1 && (
            <polyline
              points={points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none"
              style={{ stroke: color }}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {h && (
            <line
              x1={sx(h.x)}
              x2={sx(h.x)}
              y1={PAD.t}
              y2={H - PAD.b}
              style={{ stroke: 'var(--c-ink-3)' }}
              strokeWidth={1}
            />
          )}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={hover === i ? 6 : 4.5}
              style={{ fill: color, stroke: 'var(--c-paper)' }}
              strokeWidth={2}
            />
          ))}
          <text
            x={sx(points[lastIdx].x) + 10}
            y={sy(points[lastIdx].y)}
            dy="0.35em"
            className="fill-[var(--c-ink)] text-[12px] font-bold tnum"
          >
            {formatY(points[lastIdx].y)}
          </text>
          {[points[0], points[lastIdx]].map((p, i) =>
            i === 1 && lastIdx === 0 ? null : (
              <text
                key={i}
                x={sx(p.x)}
                y={H - 8}
                textAnchor={i === 0 ? 'start' : 'end'}
                className="fill-[var(--c-ink-3)] text-[11px]"
              >
                {formatX(p.x)}
              </text>
            ),
          )}
          {points.map((p, i) => (
            <rect
              key={`hit${i}`}
              x={sx(p.x) - 18}
              y={PAD.t}
              width={36}
              height={H - PAD.t - PAD.b}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${p.label}: ${formatY(p.y)}`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover((x) => (x === i ? null : x))}
              onFocus={() => setHover(i)}
              onBlur={() => setHover((x) => (x === i ? null : x))}
              className="outline-none focus-visible:stroke-[var(--c-leaf)]"
            />
          ))}
        </svg>
        {h && (
          <div
            className="pointer-events-none absolute top-0 rounded-xl border border-line bg-paper px-3 py-1.5 text-[12.5px] shadow-pop"
            style={{ left: `${(sx(h.x) / W) * 100}%`, transform: 'translateX(-50%)' }}
            role="status"
          >
            <span className="text-ink-3">{h.label}</span>{' '}
            <span className="font-bold text-ink tnum">{formatY(h.y)}</span>
          </div>
        )}
      </div>
      <figcaption id={`${uid}-cap`} className="sr-only">
        {caption}
      </figcaption>
      {/* tables ignore sr-only's 1px width, so the wrapper hides it */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <th scope="row">{p.label}</th>
                <td>{formatY(p.y)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
