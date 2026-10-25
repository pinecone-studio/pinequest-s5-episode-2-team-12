'use client';
// Isometric map of Mongolia with the 26 stops. The flat projected map (map/mongolia.generated.ts) is tilted
// with one affine matrix; pins and cards are HTML buttons positioned with the same matrix so they stay upright,
// crisp and keyboard-focusable. Pan: drag / arrows. Zoom: wheel / pinch / + −. No map library.
import {
  memo,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import {
  centerOn,
  clampView,
  declutter,
  fitView,
  isoMatrix,
  type Pt,
  routeSegments,
  type Size,
  svgMatrix,
  TILT,
  toScreen,
  type View,
  ZOOM,
  zoomAt,
} from '../lib/iso';
import { type StopView, stopAriaLabel } from '../lib/view';
import { MAP } from '../map/mongolia.generated';
import { STOPS } from '../stops';
import type { StopStatus } from '../types';
import { StopCard } from './StopCard';
import { CheckIcon, LockIcon } from './TopicIcon';

const ISO = isoMatrix(MAP.width, MAP.height);
const MATRIX = svgMatrix(ISO);
const CONTENT: Size = { w: ISO.width, h: ISO.height };
const POINTS: Record<number, Pt> = Object.fromEntries(
  STOPS.map((s) => [s.no, toScreen(ISO, MAP.points[s.no])]),
);
const SEGMENTS = routeSegments(STOPS.map((s) => POINTS[s.no]));
const EXTRUDE = Array.from({ length: Math.ceil(TILT.depth / 2) }, (_, i) => TILT.depth - i * 2);

const TILE: Record<StopStatus, string> = {
  locked: 'var(--c-line-2)',
  available: 'var(--c-lime)',
  current: 'var(--c-lime)',
  completed: 'var(--c-leaf)',
  'tested-out': 'var(--c-leaf)',
};

/** Decorative SVG: extruded country, glowing aimag borders, route, a tile under every stop. */
const MapArt = memo(function MapArt({
  statuses,
  frontierIndex,
}: {
  statuses: string;
  frontierIndex: number;
}) {
  const st = statuses.split(',') as StopStatus[];
  const uid = useId().replace(/:/g, '');
  const id = (n: string) => `${uid}-${n}`;
  return (
    <svg
      width={CONTENT.w}
      height={CONTENT.h}
      className="absolute inset-0 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id('top')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--rm-top-1)' }} />
          <stop offset="1" style={{ stopColor: 'var(--rm-top-2)' }} />
        </linearGradient>
        <filter id={id('glow')} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={id('shadow')} x="-10%" y="-30%" width="120%" height="160%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>

      <g transform={`translate(0 ${TILT.depth + 10})`} opacity="0.35" filter={`url(#${id('shadow')})`}>
        <path d={MAP.outline} transform={MATRIX} style={{ fill: 'var(--c-forest)' }} />
      </g>
      {EXTRUDE.map((k) => (
        <g key={k} transform={`translate(0 ${k})`}>
          <path d={MAP.outline} transform={MATRIX} style={{ fill: 'var(--rm-side)' }} />
        </g>
      ))}
      <path
        d={MAP.outline}
        transform={MATRIX}
        fill={`url(#${id('top')})`}
        style={{ stroke: 'var(--c-leaf)' }}
        strokeWidth={1.6}
        vectorEffect="non-scaling-stroke"
      />
      <g transform={MATRIX} fill="none" vectorEffect="non-scaling-stroke">
        <g filter={`url(#${id('glow')})`} style={{ stroke: 'var(--rm-glow)' }} strokeWidth={1.8}>
          {MAP.aimags.map((a) => (
            <path key={a.iso} d={a.d} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
        <g style={{ stroke: 'var(--rm-border)' }} strokeWidth={0.8}>
          {MAP.aimags.map((a) => (
            <path key={a.iso} d={a.d} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      </g>

      <g fill="none" strokeLinecap="round">
        {SEGMENTS.map((d, i) => {
          // leg i joins stop i+1 → i+2
          if (i + 1 < frontierIndex)
            return (
              <path
                key={i}
                d={d}
                style={{ stroke: 'var(--c-lime)' }}
                strokeWidth={3.5}
                filter={`url(#${id('glow')})`}
              />
            );
          if (i + 1 === frontierIndex)
            return (
              <path
                key={i}
                d={d}
                className="roadmap-dash"
                style={{ stroke: 'var(--c-lime)' }}
                strokeWidth={3}
              />
            );
          return (
            <path
              key={i}
              d={d}
              style={{ stroke: 'var(--rm-route-dim)' }}
              strokeWidth={2}
              strokeDasharray="2 6"
            />
          );
        })}
      </g>

      {STOPS.map((s, i) => {
        const [x, y] = POINTS[s.no];
        const rh = (dy: number) =>
          `${x},${y - 7 + dy} ${x + 13},${y + dy} ${x},${y + 7 + dy} ${x - 13},${y + dy}`;
        return (
          <g key={s.no}>
            <polygon points={rh(4)} style={{ fill: 'var(--rm-side)' }} />
            <polygon points={rh(0)} style={{ fill: TILE[st[i]], stroke: 'var(--c-paper)' }} strokeWidth={1} />
          </g>
        );
      })}
    </svg>
  );
});

function CoinGlyph({ v }: { v: StopView }) {
  if (v.status === 'locked') return <LockIcon size={17} />;
  if (v.status === 'completed' || v.status === 'tested-out') return <CheckIcon size={18} />;
  return <span className="tnum">{v.stop.no}</span>;
}

export function RoadmapMap({
  views,
  frontierNo,
  onOpen,
  className,
  fullBleed = false,
}: {
  views: StopView[];
  /** Current position; null when every stop is done. */
  frontierNo: number | null;
  onOpen: (no: number) => void;
  className?: string;
  /** Edge to edge under the floating top bar (the home screen): no frame, controls clear the safe area. */
  fullBleed?: boolean;
}) {
  const t = useT('roadmap');
  const helpId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Size | null>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const moved = useRef(false);
  const pointers = useRef(new Map<number, Pt>());
  const pinch = useRef<{ dist: number; mid: Pt } | null>(null);

  const fit = useMemo(() => (box ? fitView(box, CONTENT) : null), [box]);
  const minScale = (fit?.scale ?? 1) * ZOOM.min;
  const maxScale = (fit?.scale ?? 1) * ZOOM.max;
  const narrow = (box?.w ?? 1000) < 768;

  const apply = useCallback(
    (v: View) => {
      if (!box) return;
      setView(clampView(v, box, CONTENT));
    },
    [box],
  );

  const locate = useCallback(() => {
    if (!box || !fit) return;
    const no = frontierNo ?? 26;
    const scale = Math.max(viewRef.current.scale, fit.scale * (narrow ? 2.4 : 1.8));
    // leave room above the pin for the floating card
    const [x, y] = POINTS[no];
    apply(centerOn([x, y - 70 / scale], box, scale));
  }, [apply, box, fit, frontierNo, narrow]);

  // measure the box; first layout: fly to the current stop (the whole map once every stop is done)
  const placed = useRef(false);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (!box || !fit || placed.current) return;
    placed.current = true;
    if (frontierNo !== null) locate();
    else setView(fit);
  }, [box, fit, locate, frontierNo]);

  // wheel zoom needs a non-passive listener to stop the page from scrolling
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !box) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      apply(
        zoomAt(
          viewRef.current,
          Math.exp(-e.deltaY * 0.0015),
          e.clientX - r.left,
          e.clientY - r.top,
          minScale,
          maxScale,
        ),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [apply, box, minScale, maxScale]);

  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = boxRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  // drag / pinch. Listeners live on window during a gesture so pin clicks are not swallowed by capture.
  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointers.current.set(e.pointerId, local(e));
    moved.current = false;
    let last = local(e);

    const onMove = (ev: PointerEvent) => {
      if (!pointers.current.has(ev.pointerId)) return;
      const p = local(ev);
      pointers.current.set(ev.pointerId, p);
      const ps = [...pointers.current.values()];
      if (ps.length >= 2) {
        const [a, b] = ps;
        const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
        const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (pinch.current) {
          const v = zoomAt(viewRef.current, dist / pinch.current.dist, mid[0], mid[1], minScale, maxScale);
          apply({ ...v, x: v.x + mid[0] - pinch.current.mid[0], y: v.y + mid[1] - pinch.current.mid[1] });
        }
        pinch.current = { dist, mid };
        moved.current = true;
        return;
      }
      const dx = p[0] - last[0];
      const dy = p[1] - last[1];
      last = p;
      if (!moved.current && Math.hypot(dx, dy) < 4) return;
      if (!moved.current) setDragging(true);
      moved.current = true;
      apply({ ...viewRef.current, x: viewRef.current.x + dx, y: viewRef.current.y + dy });
    };
    const onUp = (ev: PointerEvent) => {
      pointers.current.delete(ev.pointerId);
      pinch.current = null;
      if (pointers.current.size === 0) {
        setDragging(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      } else {
        last = [...pointers.current.values()][0];
      }
    };
    if (pointers.current.size === 1) {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }
  };

  const zoomBy = (f: number) => box && apply(zoomAt(view, f, box.w / 2, box.h / 2, minScale, maxScale));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const step = 60;
    const pan = (dx: number, dy: number) => apply({ ...view, x: view.x + dx, y: view.y + dy });
    const keys: Record<string, () => void> = {
      arrowleft: () => pan(step, 0),
      arrowright: () => pan(-step, 0),
      arrowup: () => pan(0, step),
      arrowdown: () => pan(0, -step),
      '+': () => zoomBy(ZOOM.step),
      '=': () => zoomBy(ZOOM.step),
      '-': () => zoomBy(1 / ZOOM.step),
      '0': () => fit && setView(fit),
    };
    const fn = keys[e.key.toLowerCase()];
    if (!fn) return;
    e.preventDefault();
    fn();
  };

  /** Keyboard focus on a pin outside the viewport pans to it. */
  const reveal = (no: number) => {
    if (!box) return;
    const [x, y] = POINTS[no];
    const sx = x * view.scale + view.x;
    const sy = y * view.scale + view.y;
    if (sx < 40 || sx > box.w - 40 || sy < 80 || sy > box.h - 30) apply(centerOn([x, y], box, view.scale));
  };

  const statuses = views.map((v) => v.status).join(',');
  const frontierIndex = frontierNo ?? 27;
  const floatNo = hover ?? frontierNo;

  // labels in screen px; the current stop and earlier stops win, crowded ones appear when zoomed in
  const labels = useMemo(() => {
    const order = [...views].sort(
      (a, b) => Number(b.stop.no === frontierNo) - Number(a.stop.no === frontierNo) || a.stop.no - b.stop.no,
    );
    return declutter(
      order.map((v) => {
        const [x, y] = POINTS[v.stop.no];
        const [ox, oy] = v.stop.offset ?? [0, 0];
        return {
          id: v.stop.no,
          x: x * view.scale + ox,
          y: y * view.scale + 6 + oy,
          w: v.stop.place.length * 7.2 + 18,
          h: 19,
        };
      }),
    );
  }, [views, frontierNo, view.scale]);

  return (
    <div className={cn('relative', className)}>
      <div
        ref={boxRef}
        role="application"
        aria-roledescription={t('map.role')}
        aria-label={t('map.label')}
        aria-describedby={helpId}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the map takes focus itself so arrow keys pan and + / − zoom
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        className={cn(
          'roadmap-stage relative h-full w-full overflow-hidden',
          !fullBleed && 'rounded-[26px] border border-line',
          dragging && 'is-dragging',
        )}
      >
        <p id={helpId} className="sr-only">
          {t('map.help')}
        </p>
        {box && (
          <div
            className="roadmap-layer absolute left-0 top-0"
            style={
              {
                width: CONTENT.w,
                height: CONTENT.h,
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                '--inv': 1 / view.scale,
              } as React.CSSProperties
            }
          >
            <MapArt statuses={statuses} frontierIndex={frontierIndex} />
            {views.map((v) => {
              const [x, y] = POINTS[v.stop.no];
              const [ox, oy] = v.stop.offset ?? [0, 0];
              const isFrontier = v.stop.no === frontierNo;
              const label = labels.has(v.stop.no) || hover === v.stop.no;
              return (
                <div
                  key={v.stop.no}
                  className="roadmap-pin"
                  data-status={v.status}
                  style={{ left: x, top: y, zIndex: floatNo === v.stop.no ? 30 : isFrontier ? 20 : 10 }}
                >
                  <span className="roadmap-stem" aria-hidden="true" />
                  {floatNo === v.stop.no && (
                    <div className="roadmap-float" aria-hidden="true">
                      <StopCard v={v} />
                    </div>
                  )}
                  <button
                    type="button"
                    className="roadmap-coin"
                    data-status={v.status}
                    aria-label={stopAriaLabel(v, t)}
                    aria-haspopup="dialog"
                    style={ox || oy ? { translate: `${ox}px ${oy}px` } : undefined}
                    onClick={() => {
                      if (moved.current) return;
                      onOpen(v.stop.no);
                    }}
                    onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(v.stop.no)}
                    onPointerLeave={() => setHover((h) => (h === v.stop.no ? null : h))}
                    onFocus={() => {
                      setHover(v.stop.no);
                      reveal(v.stop.no);
                    }}
                    onBlur={() => setHover((h) => (h === v.stop.no ? null : h))}
                  >
                    <CoinGlyph v={v} />
                  </button>
                  {label && (
                    <span className="roadmap-label" style={{ left: ox, marginTop: oy }} aria-hidden="true">
                      {v.stop.place}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className={cn(
          'absolute right-3 flex flex-col items-end gap-2',
          fullBleed ? 'bottom-[max(16px,env(safe-area-inset-bottom))]' : 'bottom-3',
        )}
      >
        <button
          type="button"
          onClick={locate}
          className="flex h-11 items-center gap-2 rounded-2xl border border-line bg-paper px-3.5 text-[13px] font-bold text-ink shadow-[var(--shadow-card)]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
          {t('map.locate')}
        </button>
        <div className="flex overflow-hidden rounded-2xl border border-line bg-paper shadow-[var(--shadow-card)]">
          {[
            { k: 'zoomOut', f: () => zoomBy(1 / ZOOM.step), g: <path d="M6 12h12" /> },
            {
              k: 'fit',
              f: () => fit && setView(fit),
              g: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
            },
            { k: 'zoomIn', f: () => zoomBy(ZOOM.step), g: <path d="M6 12h12M12 6v12" /> },
          ].map((b) => (
            <button
              key={b.k}
              type="button"
              onClick={b.f}
              aria-label={t(`map.${b.k}`)}
              title={t(`map.${b.k}`)}
              className="grid size-11 place-items-center text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                aria-hidden="true"
              >
                {b.g}
              </svg>
            </button>
          ))}
        </div>
      </div>
      <p className="pointer-events-none absolute bottom-2 left-4 text-[10.5px] text-ink-3">
        {t('map.attribution')}
      </p>
    </div>
  );
}
