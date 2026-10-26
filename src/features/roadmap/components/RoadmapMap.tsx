'use client';
// Map of Mongolia with the 26 stops. The terrain is a baked image (scripts/roadmap/build-terrain.ts: real relief
// from a DEM, biome colors, lakes) in the same projection as the borders and points (map/mongolia.generated.ts);
// one affine matrix tilts both, and a stack of offset outlines makes the soil-and-rock slab edge. Pins, clusters
// and labels are HTML so they stay upright, crisp and keyboard-focusable. Pan: drag / arrows. Zoom: wheel /
// pinch / + −. No map library, no WebGL.
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
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import {
  centerOn,
  clampView,
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
import { CHIP, clusterPins, FLOAT, labelWidth, placeLabels } from '../lib/labels';
import { type StopView, stopAriaLabel } from '../lib/view';
import { MAP } from '../map/mongolia.generated';
import { STOPS } from '../stops';
import { StopCard } from './StopCard';
import { StarRow } from './TopicIcon';

const ISO = isoMatrix(MAP.width, MAP.height);
const MATRIX = svgMatrix(ISO);
const CONTENT: Size = { w: ISO.width, h: ISO.height };
const POINTS: Record<number, Pt> = Object.fromEntries(
  STOPS.map((s) => [s.no, toScreen(ISO, MAP.points[s.no])]),
);
const SEGMENTS = routeSegments(STOPS.map((s) => POINTS[s.no]));
const TREES = MAP.props.trees.map((p) => toScreen(ISO, p));
const GERS = MAP.props.gers.map((p) => toScreen(ISO, p));

/** Slab edge, top to bottom: grass lip, topsoil, subsoil, rock, bedrock (1.5px steps). */
const STRATA = Array.from({ length: Math.ceil(TILT.depth / 1.5) }, (_, i) => {
  const dy = TILT.depth - i * 1.5;
  const f = dy / TILT.depth;
  const layer = f < 0.12 ? 'lip' : f < 0.4 ? 'soil' : f < 0.62 ? 'subsoil' : f < 0.86 ? 'rock' : 'bed';
  return { dy, layer };
});

const TERRAIN_WIDTHS = [1024, 2048, 3072];

/** Below this zoom (× the fit scale) nearby pins merge into clusters; above LABEL_ZOOM every label shows. */
const CLUSTER_ZOOM = 1.35;
const LABEL_ZOOM = 1.4;
const CLUSTER_RADIUS = 30;
/** Pins closer than this would overlap as tap targets, so they cluster at any zoom. */
const OVERLAP_RADIUS = 22;
const FLY_MS = 650;

/** Shadow under the country and the layered soil/rock edge. */
const MapBase = memo(function MapBase() {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      width={CONTENT.w}
      height={CONTENT.h}
      className="absolute inset-0 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <filter id={`${uid}-shadow`} x="-10%" y="-30%" width="120%" height="160%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
      </defs>
      <g transform={`translate(0 ${TILT.depth + 14})`} opacity="0.45" filter={`url(#${uid}-shadow)`}>
        <path d={MAP.outline} transform={MATRIX} style={{ fill: 'var(--rm-shadow)' }} />
      </g>
      {STRATA.map(({ dy, layer }) => (
        <g key={dy} transform={`translate(0 ${dy})`}>
          <path d={MAP.outline} transform={MATRIX} style={{ fill: `var(--rm-${layer})` }} />
        </g>
      ))}
    </svg>
  );
});

/** Draped aimag borders, the route, trees and gers — over the terrain image. */
const MapOverlay = memo(function MapOverlay({ frontierIndex }: { frontierIndex: number }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      width={CONTENT.w}
      height={CONTENT.h}
      className="absolute inset-0 overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <filter id={`${uid}-glow`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <symbol id={`${uid}-tree`} viewBox="0 0 24 24">
          <path d="M12 2 5 13h4l-4 6h14l-4-6h4z" style={{ fill: 'var(--rm-tree)' }} />
          <rect x="11" y="19" width="2" height="3" style={{ fill: 'var(--rm-bed)' }} />
        </symbol>
        <symbol id={`${uid}-ger`} viewBox="0 0 24 24">
          <path d="M3 14c2-5 5-7 9-7s7 2 9 7z" style={{ fill: 'var(--rm-ger)' }} />
          <rect x="4" y="14" width="16" height="6" rx="1" style={{ fill: 'var(--rm-ger)' }} />
          <rect x="10.5" y="15" width="3" height="5" style={{ fill: 'var(--rm-ger-door)' }} />
          <path d="M3 14h18" style={{ stroke: 'var(--rm-ger-door)' }} strokeWidth="1" />
        </symbol>
      </defs>

      <g transform={MATRIX} fill="none">
        <path
          d={MAP.outline}
          style={{ stroke: 'var(--rm-edge)' }}
          strokeWidth={1.2}
          vectorEffect="non-scaling-stroke"
        />
        <g style={{ stroke: 'var(--rm-border-shadow)' }} strokeWidth={2.2}>
          {MAP.aimags.map((a) => (
            <path key={a.iso} d={a.d} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
        <g style={{ stroke: 'var(--rm-border)' }} strokeWidth={1.1}>
          {MAP.aimags.map((a) => (
            <path key={a.iso} d={a.d} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      </g>

      {TREES.map(([x, y], i) => (
        <g key={`t${i}`} opacity="0.9">
          <use href={`#${uid}-tree`} x={x - 13} y={y - 16} width="14" height="14" />
          <use href={`#${uid}-tree`} x={x - 3} y={y - 19} width="16" height="16" />
          <use href={`#${uid}-tree`} x={x + 6} y={y - 13} width="12" height="12" />
        </g>
      ))}
      {GERS.map(([x, y], i) => (
        <g key={`g${i}`}>
          <use href={`#${uid}-ger`} x={x - 14} y={y - 12} width="12" height="12" />
          <use href={`#${uid}-ger`} x={x - 2} y={y - 10} width="10" height="10" />
        </g>
      ))}

      <g fill="none" strokeLinecap="round">
        {SEGMENTS.map((d, i) => {
          // leg i joins stop i+1 → i+2
          if (i + 1 < frontierIndex)
            return (
              <path
                key={i}
                d={d}
                style={{ stroke: 'var(--rm-route-done)' }}
                strokeWidth={3.5}
                filter={`url(#${uid}-glow)`}
              />
            );
          if (i + 1 === frontierIndex)
            return (
              <path
                key={i}
                d={d}
                className="roadmap-dash"
                style={{ stroke: 'var(--rm-route-next)' }}
                strokeWidth={3}
                filter={`url(#${uid}-glow)`}
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
    </svg>
  );
});

/** Slowly drifting clouds over the terrain (static with reduced motion). */
const Clouds = memo(function Clouds() {
  const clouds = [
    { x: 0.34, y: 0.3, w: 120, d: 0 },
    { x: 0.68, y: 0.22, w: 90, d: -18 },
    { x: 0.52, y: 0.62, w: 140, d: -34 },
  ];
  return (
    <>
      {clouds.map((c) => (
        <span
          key={c.x}
          className="roadmap-cloud"
          aria-hidden="true"
          style={{
            left: c.x * CONTENT.w,
            top: c.y * CONTENT.h,
            width: c.w,
            height: c.w * 0.45,
            animationDelay: `${c.d}s`,
          }}
        />
      ))}
    </>
  );
});

/** The classic red map pin with the stop's glyph in its white head. */
function PinGlyph({ v }: { v: StopView }) {
  return (
    <>
      <svg width="30" height="42" viewBox="0 0 30 42" className="roadmap-pin-svg" aria-hidden="true">
        <path
          d="M15 41.2S2 25.9 2 15.2a13 13 0 0 1 26 0C28 25.9 15 41.2 15 41.2z"
          className="roadmap-pin-body"
        />
        <path d="M15 4.2a11 11 0 0 1 10.2 6.9" className="roadmap-pin-shine" />
        <circle cx="15" cy="15" r="8.6" className="roadmap-pin-head" />
      </svg>
      <span className="roadmap-pin-glyph" aria-hidden="true">
        <span className="tnum">{v.stop.no}</span>
      </span>
    </>
  );
}

/** The smallest terrain image that is sharp at this zoom (device pixels capped at 2×; 1× on Save-Data). */
function useTerrainHref(scale: number, laidOut: boolean): string {
  const [dpr, setDpr] = useState(1);
  useEffect(() => {
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const device = window.devicePixelRatio || 1;
    // the browser multiplies `sizes` by the device ratio; this factor caps the result
    setDpr((saveData ? 1 : Math.min(2, device)) / device);
  }, []);
  // device px the image needs; the first paint always uses the preloaded 1024
  const need = MAP.width * scale * dpr * (typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
  const width = !laidOut
    ? 1024
    : (TERRAIN_WIDTHS.find((w) => w >= need) ?? TERRAIN_WIDTHS[TERRAIN_WIDTHS.length - 1]);
  // never step back down: the bigger image is already cached
  const [max, setMax] = useState(1024);
  useEffect(() => setMax((m) => Math.max(m, width)), [width]);
  return `/map/terrain-${Math.max(max, width)}.webp`;
}

export function RoadmapMap({
  views,
  frontierNo,
  onOpen,
  className,
  fullBleed = false,
  cluster = true,
  selectedNo = null,
  skin,
  showTopicHeading = true,
}: {
  views: StopView[];
  /** Current position; null when every stop is done. */
  frontierNo: number | null;
  onOpen: (no: number) => void;
  className?: string;
  /** Edge to edge under the floating top bar (the home screen): fixed at the bottom, without camera controls. */
  fullBleed?: boolean;
  /** Merge crowded pins into clusters when zoomed out. */
  cluster?: boolean;
  /** The stop whose panel is open: its label is highlighted. Framed maps also fly to it. */
  selectedNo?: number | null;
  /** Shop map skin: 'winter' | 'night'. */
  skin?: string;
  showTopicHeading?: boolean;
}) {
  const t = useT('roadmap');
  const helpId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Size | null>(null);
  const [camera, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  // The home map stays fitted and anchored to the bottom, including after a resize.
  const fixedView = box ? fitView(box, CONTENT) : null;
  const view =
    fullBleed && box && fixedView
      ? { ...fixedView, x: fixedView.x + 20, y: box.h - CONTENT.h * fixedView.scale + 28 }
      : camera;
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState(false);
  const flyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      if (!box || fullBleed) return;
      setView(clampView(v, box, CONTENT));
    },
    [box, fullBleed],
  );

  /** Animated camera move (locate, cluster zoom, fit). */
  const fly = useCallback(
    (v: View) => {
      if (flyTimer.current) clearTimeout(flyTimer.current);
      setFlying(true);
      apply(v);
      flyTimer.current = setTimeout(() => setFlying(false), FLY_MS);
    },
    [apply],
  );
  useEffect(
    () => () => {
      if (flyTimer.current) clearTimeout(flyTimer.current);
    },
    [],
  );

  // a panel opened: zoom toward the stop, keeping it clear of the side panel (desktop) or the sheet (phone)
  useEffect(() => {
    if (fullBleed || selectedNo === null || !box || !fit) return;
    const [x, y] = POINTS[selectedNo];
    const scale = Math.max(viewRef.current.scale, fit.scale * LABEL_ZOOM * 1.15);
    const target = narrow ? { x: box.w / 2, y: box.h * 0.27 } : { x: (box.w - 440) / 2, y: box.h / 2 };
    fly({ scale, x: target.x - x * scale, y: target.y - y * scale });
  }, [selectedNo, box, fit, narrow, fly, fullBleed]);

  const locate = useCallback(() => {
    if (!box || !fit) return;
    const no = frontierNo ?? 26;
    const scale = Math.max(viewRef.current.scale, fit.scale * (narrow ? 2.4 : 1.9));
    // wide screens leave room above the pin for the floating card; phones have none
    const [x, y] = POINTS[no];
    fly(centerOn([x, narrow ? y : y - 70 / scale], box, scale));
  }, [fly, box, fit, frontierNo, narrow]);

  // measure the box; first layout: fly to the current stop (the whole map once every stop is done)
  const placed = useRef(false);
  // the terrain loads only once the first view is set, so `sizes` never asks for the zoom-1 (oversized) image
  const [laidOut, setLaidOut] = useState(false);
  const terrainHref = useTerrainHref(view.scale, laidOut);
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
    setView(fit);
    setLaidOut(true);
    if (!fullBleed && frontierNo !== null) requestAnimationFrame(() => locate());
  }, [box, fit, locate, frontierNo, fullBleed]);

  // wheel zoom needs a non-passive listener to stop the page from scrolling
  useEffect(() => {
    const el = boxRef.current;
    if (!el || !box || fullBleed) return;
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
  }, [apply, box, minScale, maxScale, fullBleed]);

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

  const zoomBy = (f: number) => box && fly(zoomAt(view, f, box.w / 2, box.h / 2, minScale, maxScale));

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
      '0': () => fit && fly(fit),
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

  const frontierIndex = frontierNo ?? 27;
  // the hover card covers too much of a phone screen; there the ring + red label mark the current stop
  const floatNo =
    narrow || selectedNo !== null
      ? null
      : fullBleed
        ? hover !== frontierNo
          ? hover
          : null
        : (hover ?? frontierNo);
  const zoom = fit ? view.scale / fit.scale : 1;

  // in layer px (scale applied, offset not): priority = current stop, then route order
  const order = useMemo(
    () =>
      [...views].sort(
        (a, b) =>
          Number(b.stop.no === selectedNo) - Number(a.stop.no === selectedNo) ||
          Number(b.stop.no === frontierNo) - Number(a.stop.no === frontierNo) ||
          a.stop.no - b.stop.no,
      ),
    [views, frontierNo, selectedNo],
  );
  const screen = useCallback(
    (no: number) => ({ id: no, x: POINTS[no][0] * view.scale, y: POINTS[no][1] * view.scale }),
    [view.scale],
  );

  const { singles, clusters } = useMemo(() => {
    const pins = order.map((v) => screen(v.stop.no));
    if (fullBleed || !cluster) return { singles: pins.map((p) => p.id), clusters: [] };
    const keep = new Set([frontierNo, selectedNo].filter((n): n is number => n !== null));
    // zoomed out: merge neighbours; zoomed in: merge only pins that would sit on top of each other
    return clusterPins(pins, zoom < CLUSTER_ZOOM ? CLUSTER_RADIUS : OVERLAP_RADIUS, keep);
  }, [order, screen, cluster, zoom, frontierNo, selectedNo, fullBleed]);
  const visible = useMemo(() => new Set(singles), [singles]);

  // labels: all of them when zoomed in, otherwise only the current / hovered stop; callouts when crowded
  const labels = useMemo(() => {
    if (flying) return new Map();
    const want = order.filter(
      (v) =>
        visible.has(v.stop.no) &&
        (zoom >= LABEL_ZOOM || v.stop.no === frontierNo || v.stop.no === hover || v.stop.no === selectedNo),
    );
    const force = new Set([selectedNo, frontierNo, hover].filter((n): n is number => n !== null));
    const chips = views
      .filter(
        (v) =>
          visible.has(v.stop.no) &&
          (v.status === 'tested-out' || (v.status === 'completed' && v.progress.stars > 0)),
      )
      .map((v) => {
        const p = screen(v.stop.no);
        return { x: p.x + CHIP.x, y: p.y + CHIP.y, w: CHIP.w, h: CHIP.h };
      });
    if (floatNo !== null && visible.has(floatNo) && zoom >= 1) {
      const p = screen(floatNo);
      chips.push({ x: p.x + FLOAT.x, y: p.y + FLOAT.y, w: FLOAT.w, h: FLOAT.h });
    }
    return placeLabels(
      want.map((v) => ({ ...screen(v.stop.no), w: labelWidth(v.stop.place) })),
      singles.map(screen),
      force,
      chips,
      !narrow,
    );
  }, [order, views, visible, zoom, frontierNo, hover, singles, screen, flying, floatNo, narrow, selectedNo]);

  const placeName = (no: number) => STOPS.find((s) => s.no === no)?.place ?? '';

  return (
    <div className={cn('relative isolate z-0', className)}>
      <div
        ref={boxRef}
        role="application"
        aria-roledescription={t('map.role')}
        aria-label={t('map.label')}
        aria-describedby={fullBleed ? undefined : helpId}
        tabIndex={fullBleed ? undefined : 0}
        onKeyDown={fullBleed ? undefined : onKeyDown}
        onPointerDown={fullBleed ? undefined : onPointerDown}
        data-skin={skin}
        className={cn(
          'roadmap-stage relative h-full w-full overflow-clip',
          !fullBleed && 'rounded-[26px] border border-line',
          dragging && 'is-dragging',
          fullBleed && 'is-fixed',
        )}
      >
        {!fullBleed && (
          <p id={helpId} className="sr-only">
            {t('map.help')}
          </p>
        )}
        {/* The terrain is server-rendered, so the first paint (and LCP) does not wait for hydration. Until the box
            is measured the layer fills the stage and the SVG fits the map ("meet" = fitView); afterwards the very
            same element moves with the pan/zoom transform — no remount, no second paint. */}
        <div
          className={cn(
            'roadmap-layer absolute',
            laidOut ? 'left-0 top-0' : 'inset-3',
            flying && 'is-flying',
            fullBleed && 'z-40',
          )}
          style={
            laidOut
              ? ({
                  width: CONTENT.w,
                  height: CONTENT.h,
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                  '--inv': 1 / view.scale,
                } as React.CSSProperties)
              : undefined
          }
        >
          {laidOut && <MapBase />}
          <svg
            className="roadmap-terrain absolute inset-0 h-full w-full overflow-visible"
            viewBox={`0 0 ${CONTENT.w} ${CONTENT.h}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            {!laidOut && (
              <path
                d={MAP.outline}
                transform={`translate(0 ${TILT.depth}) ${MATRIX}`}
                style={{ fill: 'var(--rm-soil)' }}
              />
            )}
            <image href={terrainHref} width={MAP.width} height={MAP.height} transform={MATRIX} />
          </svg>
          {box && laidOut && (
            <>
              <MapOverlay frontierIndex={frontierIndex} />
              <Clouds />
              {views.map((v) => {
                if (!visible.has(v.stop.no)) return null;
                const [x, y] = POINTS[v.stop.no];
                const isFrontier = v.stop.no === frontierNo;
                const done = v.status === 'completed' || v.status === 'tested-out';
                return (
                  <div
                    key={v.stop.no}
                    className="roadmap-pin"
                    data-status={v.status}
                    style={{
                      left: x,
                      top: y,
                      zIndex: selectedNo === v.stop.no || floatNo === v.stop.no ? 30 : isFrontier ? 20 : 10,
                    }}
                  >
                    <span className="roadmap-shadow" aria-hidden="true" />
                    {isFrontier && <span className="roadmap-ring" aria-hidden="true" />}
                    {floatNo === v.stop.no &&
                      zoom >= 1 &&
                      (fullBleed ? (
                        createPortal(
                          <div
                            className="roadmap-float"
                            aria-hidden="true"
                            style={{
                              position: 'fixed',
                              left:
                                (boxRef.current?.getBoundingClientRect().left ?? 0) +
                                view.x +
                                x * view.scale -
                                100,
                              bottom:
                                window.innerHeight -
                                (boxRef.current?.getBoundingClientRect().top ?? 0) -
                                view.y -
                                y * view.scale +
                                58,
                              zIndex: 60,
                            }}
                          >
                            <StopCard v={v} />
                          </div>,
                          document.body,
                        )
                      ) : (
                        <div className="roadmap-float" aria-hidden="true">
                          <StopCard v={v} />
                        </div>
                      ))}
                    <button
                      type="button"
                      className="roadmap-coin"
                      data-current={isFrontier ? 'true' : undefined}
                      aria-current={isFrontier ? 'step' : undefined}
                      data-status={v.status}
                      aria-label={stopAriaLabel(v, t)}
                      aria-haspopup="dialog"
                      onClick={() => {
                        if (moved.current) return;
                        onOpen(v.stop.no);
                      }}
                      onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(v.stop.no)}
                      onPointerLeave={() => setHover((h) => (h === v.stop.no ? null : h))}
                      onFocus={() => {
                        setHover(v.stop.no);
                        if (!fullBleed) reveal(v.stop.no);
                      }}
                      onBlur={() => setHover((h) => (h === v.stop.no ? null : h))}
                    >
                      <PinGlyph v={v} />
                    </button>
                    {done && v.status === 'completed' && v.progress.stars > 0 && (
                      <span className="roadmap-stars" aria-hidden="true">
                        <StarRow stars={v.progress.stars} size={11} />
                      </span>
                    )}
                    {v.status === 'tested-out' && (
                      <span className="roadmap-passed" aria-hidden="true">
                        {t('pin.passed')}
                      </span>
                    )}
                  </div>
                );
              })}
              {clusters.map((c) => {
                const names = c.ids.map(placeName);
                return (
                  <div
                    key={c.ids.join('-')}
                    className="roadmap-pin"
                    style={{ left: c.x / view.scale, top: c.y / view.scale, zIndex: 15 }}
                  >
                    <span className="roadmap-shadow" aria-hidden="true" />
                    <button
                      type="button"
                      className="roadmap-cluster"
                      aria-label={t('pin.cluster', { n: c.ids.length, names: names.join(', ') })}
                      onClick={() => {
                        if (moved.current || !box) return;
                        const pts = c.ids.map((no) => POINTS[no]);
                        const xs = pts.map((p) => p[0]);
                        const ys = pts.map((p) => p[1]);
                        const span = Math.max(
                          Math.max(...xs) - Math.min(...xs),
                          Math.max(...ys) - Math.min(...ys),
                          1,
                        );
                        const fitScale = fit?.scale ?? view.scale;
                        const scale = Math.min(
                          maxScale,
                          Math.max(fitScale * LABEL_ZOOM * 1.05, Math.min(box.w, box.h) / (span * 3.2)),
                        );
                        fly(
                          centerOn(
                            [xs.reduce((a, b) => a + b) / xs.length, ys.reduce((a, b) => a + b) / ys.length],
                            box,
                            scale,
                          ),
                        );
                      }}
                    >
                      <span className="tnum">{c.ids.length}</span>
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
        {box && laidOut && (
          <>
            {/* labels and leader lines in screen px, so text stays crisp at any zoom */}
            <div
              className="pointer-events-none absolute left-0 top-0"
              style={{ transform: `translate(${view.x}px, ${view.y}px)` }}
              aria-hidden="true"
            >
              <svg className="absolute left-0 top-0 overflow-visible" width="1" height="1">
                {[...labels.values()].map(
                  (l) =>
                    l.leader && (
                      <g key={l.id} className="roadmap-leader">
                        <line x1={l.leader.x1} y1={l.leader.y1} x2={l.leader.x2} y2={l.leader.y2} />
                        <circle cx={l.leader.x2} cy={l.leader.y2} r="2.5" />
                      </g>
                    ),
                )}
              </svg>
              {[...labels.values()].map((l) => {
                const v = views.find((x) => x.stop.no === l.id);
                return (
                  <span
                    key={l.id}
                    className={cn(
                      'roadmap-label',
                      l.id === frontierNo && 'is-current',
                      l.id === selectedNo && 'is-selected',
                      l.leader && 'is-callout',
                    )}
                    data-status={v?.status}
                    style={{ left: l.box.x, top: l.box.y, width: l.box.w }}
                  >
                    {placeName(l.id)}
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>

      {fullBleed &&
        showTopicHeading &&
        frontierNo !== null &&
        (() => {
          const current = views.find((v) => v.stop.no === frontierNo);
          return current ? (
            <div
              className="roadmap-featured-topic pointer-events-none absolute left-1/2 top-[clamp(96px,12vh,160px)] z-30 w-[620px] max-w-[calc(100%-48px)] -translate-x-1/2 text-center"
              aria-hidden="true"
            >
              <p className="eyebrow text-leaf-2">{t('stopNo', { n: current.stop.no })}</p>
              <h2 className="mt-3 font-display text-[clamp(30px,3.5vw,52px)] font-bold leading-[1.12] tracking-tight text-ink">
                {current.topic.title}
              </h2>
              <p className="mt-4 text-base text-ink-3">
                {current.stop.place} · {current.stop.aimag}
              </p>
            </div>
          ) : null;
        })()}

      {!fullBleed && (
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
                f: () => fit && fly(fit),
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
      )}
      <p
        className={cn(
          'pointer-events-none absolute left-4 max-w-[60%] text-[10.5px] leading-tight text-ink-3',
          fullBleed ? 'bottom-[max(4px,env(safe-area-inset-bottom))] max-sm:hidden' : 'bottom-2',
        )}
      >
        {t('map.attribution')}
      </p>
    </div>
  );
}
