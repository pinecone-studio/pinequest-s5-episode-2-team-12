'use client';
// Radar (spider) chart for 3–8 axes valued 0..1, with up to two series (now vs an earlier snapshot).
// Thin 2px outlines, a 10% wash, ≥8px vertex dots with a surface ring, recessive hairline grid; a legend for
// two series; a hover/focus tooltip per axis; an sr-only table with every value. Axes without data (null)
// show a hollow marker at the centre instead of a fake zero.
import { useId, useState } from 'react';

export type RadarSeries = { id: string; label: string; values: (number | null)[]; color: string };

const SIZE = 280;
const C = SIZE / 2;
const R = 100;
const RINGS = [0.25, 0.5, 0.75, 1];
/** Room left and right of the plot for axis labels (they wrap to two lines, so ~14 characters wide). */
const PAD_X = 96;

/** Long labels («Шугаман функц, систем») split onto two lines at the space nearest the middle. */
function wrap(label: string): string[] {
  if (label.length <= 14) return [label];
  const mid = label.length / 2;
  let cut = -1;
  for (let i = 0; i < label.length; i++)
    if (label[i] === ' ' && (cut < 0 || Math.abs(i - mid) < Math.abs(cut - mid))) cut = i;
  return cut < 0 ? [label] : [label.slice(0, cut), label.slice(cut + 1)];
}

function point(i: number, n: number, v: number): [number, number] {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v];
}

export function RadarChart({
  axes,
  series,
  caption,
  format = (v) => `${Math.round(v * 100)}%`,
  emptyLabel,
}: {
  axes: string[];
  series: RadarSeries[];
  caption: string;
  format?: (v: number) => string;
  /** Shown for an axis with too little data. */
  emptyLabel: string;
}) {
  const uid = useId();
  const [hover, setHover] = useState<number | null>(null);
  const n = axes.length;

  return (
    <figure className="grid gap-3">
      <div className="relative mx-auto w-full max-w-[420px]">
        <svg
          viewBox={`${-PAD_X} -14 ${SIZE + PAD_X * 2} ${SIZE + 28}`}
          className="w-full overflow-hidden"
          role="img"
          aria-labelledby={`${uid}-cap`}
        >
          {RINGS.map((r) => (
            <polygon
              key={r}
              points={axes.map((_, i) => point(i, n, r).join(',')).join(' ')}
              fill="none"
              style={{ stroke: 'var(--chart-grid)' }}
              strokeWidth={1}
            />
          ))}
          {axes.map((label, i) => {
            const [x, y] = point(i, n, 1);
            const [lx, ly] = point(i, n, 1.2);
            const anchor = Math.abs(lx - C) < 8 ? 'middle' : lx > C ? 'start' : 'end';
            return (
              <g key={label}>
                <line x1={C} y1={C} x2={x} y2={y} style={{ stroke: 'var(--chart-grid)' }} strokeWidth={1} />
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  className="fill-[var(--c-ink-2)] text-[11px] font-semibold"
                >
                  {wrap(label).map((line, k, all) => (
                    <tspan key={line} x={lx} dy={k === 0 ? `${0.35 - (all.length - 1) * 0.55}em` : '1.1em'}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
          {series.map((s) => {
            const pts = s.values.map((v, i) => point(i, n, v ?? 0));
            return (
              <g key={s.id}>
                <polygon
                  points={pts.map((p) => p.join(',')).join(' ')}
                  style={{ fill: s.color, stroke: s.color }}
                  fillOpacity={0.1}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
                {pts.map(([x, y], i) =>
                  s.values[i] === null ? (
                    <circle
                      key={i}
                      cx={C}
                      cy={C}
                      r={3}
                      fill="none"
                      style={{ stroke: s.color }}
                      strokeWidth={1.5}
                    />
                  ) : (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={4.5}
                      style={{ fill: s.color, stroke: 'var(--c-paper)' }}
                      strokeWidth={2}
                    />
                  ),
                )}
              </g>
            );
          })}
          {/* hit targets per axis, larger than the marks */}
          {axes.map((label, i) => {
            const [x, y] = point(i, n, 0.85);
            return (
              <circle
                key={label}
                cx={x}
                cy={y}
                r={22}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`${label}: ${series.map((s) => `${s.label} ${s.values[i] === null ? emptyLabel : format(s.values[i]!)}`).join(', ')}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover((h) => (h === i ? null : h))}
                onFocus={() => setHover(i)}
                onBlur={() => setHover((h) => (h === i ? null : h))}
                className="cursor-default outline-none focus-visible:stroke-[var(--c-leaf)] focus-visible:[stroke-width:2]"
              />
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-xl border border-line bg-paper px-3 py-2 text-[12.5px] shadow-pop"
            role="status"
          >
            <p className="font-bold text-ink">{axes[hover]}</p>
            {series.map((s) => (
              <p key={s.id} className="flex items-center gap-2 text-ink-2">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                {s.label}:{' '}
                <span className="font-bold text-ink tnum">
                  {s.values[hover] === null ? emptyLabel : format(s.values[hover]!)}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
      {series.length > 1 && (
        <ul className="flex flex-wrap justify-center gap-4 text-[12.5px] text-ink-2">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <figcaption id={`${uid}-cap`} className="sr-only">
        {caption}
      </figcaption>
      {/* tables ignore sr-only's 1px width, so the wrapper hides it */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">{caption}</th>
              {series.map((s) => (
                <th key={s.id} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {axes.map((a, i) => (
              <tr key={a}>
                <th scope="row">{a}</th>
                {series.map((s) => (
                  <td key={s.id}>{s.values[i] === null ? emptyLabel : format(s.values[i]!)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
