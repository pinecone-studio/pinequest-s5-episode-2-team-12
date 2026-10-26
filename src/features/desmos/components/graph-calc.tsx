'use client';
// SuuPrep graphing calculator — a Desmos-style workspace built for teaching.
// Not the official Desmos calculator: a functional simulation that supports the
// interactions SAT Math lessons need (equations, inequalities, points, sliders,
// tables + linear regression, POIs: roots / intercepts / extrema / intersections).
import {
  type CSSProperties,
  type MutableRefObject,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Tex } from '@/components/math';
import { useT } from '@/lib/i18n-client';
import { evaluate, fmt } from '../lib/expr';
import {
  buildEnv,
  findPois,
  fmtPoint,
  missingSliders,
  PALETTE,
  type Parsed,
  POI_LABEL_KEY,
  type Poi,
  parseRow,
  type Row,
} from '../lib/graph';
import { useGraphTheme } from '../lib/use-graph-theme';
import { hitPoi as findHitPoi, screenToWorld, worldToScreen } from '../lib/viewport';
import {
  LuEye,
  LuEyeOff,
  LuHouse,
  LuKeyboard,
  LuMinus,
  LuPlus,
  LuSquareFunction,
  LuTable,
  LuTriangleAlert,
  LuX,
} from './icons';

export type TableInit = { table: [number, number][]; regression?: boolean };
export type GraphState = { rows: Row[]; parsed: Parsed[]; env: Record<string, number> };
export type GraphApi = {
  addRow: (text: string) => void;
  typeRow: (text: string) => Promise<void>;
  setSlider: (name: string, v: number) => void;
  focusPoint: (x: number, y: number) => void;
  getState: () => GraphState;
};
export type ViewEvent = 'pan' | 'zoom' | 'home';
type View = { cx: number; cy: number; scale: number };

let rid = 0;
const newId = () => `r${++rid}`;

function makeRows(raw: (string | TableInit)[], prefix: string): Row[] {
  const init = raw.length && raw[raw.length - 1] === '' ? raw : [...raw, ''];
  return init.map((it, i) =>
    typeof it === 'string'
      ? { id: `${prefix}-${i}`, kind: 'expr', text: it, color: PALETTE[i % PALETTE.length] }
      : {
          id: `${prefix}-${i}`,
          kind: 'table',
          xs: [...it.table.map((p) => String(p[0])), ''],
          ys: [...it.table.map((p) => String(p[1])), ''],
          regression: it.regression,
          color: PALETTE[i % PALETTE.length],
        },
  );
}

function cssVar(el: HTMLElement, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim() || getComputedStyle(el).color;
}

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
}

export default function GraphCalc({
  initialRows = [''],
  height = 460,
  onState,
  onPoi,
  onView,
  highlight,
  apiRef,
  initialView = { cx: 0, cy: 0, scale: 32 },
  listWidth = 300,
  hideList = false,
  label,
}: {
  initialRows?: (string | TableInit)[];
  height?: number | string;
  onState?: (s: GraphState) => void;
  onPoi?: (p: Poi) => void;
  onView?: (e: ViewEvent) => void;
  highlight?: { x: number; y: number } | null;
  apiRef?: MutableRefObject<GraphApi | null>;
  initialView?: View;
  listWidth?: number;
  hideList?: boolean;
  label?: string;
}) {
  const t = useT('desmos');
  const prefix = useId();
  const [rows, setRows] = useState<Row[]>(() => makeRows(initialRows, prefix));
  const [view, setView] = useState<View>(initialView);
  const [size, setSize] = useState({ w: 600, h: 400 });
  const [selected, setSelected] = useState<string | null>(null);
  const [pinned, setPinned] = useState<Poi[]>([]);
  const [hoverPoi, setHoverPoi] = useState<Poi | null>(null);
  const [trace, setTrace] = useState<{ x: number; y: number; color: string } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [keypad, setKeypad] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  useGraphTheme(); // redraw when token colours change
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const parsed = useMemo(() => rows.map(parseRow), [rows]);
  const env = useMemo(() => buildEnv(parsed), [parsed]);
  const missing = useMemo(() => missingSliders(parsed, env), [parsed, env]);

  // world ↔ screen
  const toSX = (x: number) => worldToScreen(x, 0, view, size).x;
  const toSY = (y: number) => worldToScreen(0, y, view, size).y;
  const toWX = (sx: number) => screenToWorld(sx, 0, view, size).x;
  const toWY = (sy: number) => screenToWorld(0, sy, view, size).y;
  const x0 = toWX(0),
    x1 = toWX(size.w);

  // regression lines become functions for POIs
  const plotRows = useMemo(() => {
    const extra: { rows: Row[]; parsed: Parsed[] } = { rows: [], parsed: [] };
    rows.forEach((r, i) => {
      const p = parsed[i];
      if (p.kind === 'table' && p.reg && !r.hidden) {
        const { m, b } = p.reg;
        extra.rows.push({ id: `${r.id}:reg`, kind: 'expr', text: '', color: r.color });
        extra.parsed.push({ kind: 'func', f: (x) => m * x + b, rel: '=', tex: '', deps: new Set() });
      }
    });
    return { rows: [...rows, ...extra.rows], parsed: [...parsed, ...extra.parsed] };
  }, [rows, parsed]);

  const allPois = useMemo(
    () => findPois(plotRows.rows, plotRows.parsed, env, x0, x1),
    [plotRows, env, x0, x1],
  );
  const visiblePois = useMemo(
    () =>
      allPois.filter(
        (p) =>
          p.kind === 'point' || (selected && p.rows.some((r) => r === selected || r === `${selected}:reg`)),
      ),
    [allPois, selected],
  );

  useEffect(() => {
    onState?.({ rows, parsed, env });
  }, [rows, parsed, env, onState]); // eslint-disable-line

  // biome-ignore lint/correctness/useExhaustiveDependencies: edits invalidate pinned coordinates, even when the new row count is unchanged
  useEffect(() => {
    setPinned([]);
    setHoverPoi(null);
    setTrace(null);
  }, [rows]);

  // ———— API for lessons ————
  const alive = useRef(true);
  const typing = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      typing.current++;
    };
  }, []);
  const stateRef = useRef({ rows, parsed, env });
  stateRef.current = { rows, parsed, env };
  const addRow = useCallback((text: string) => {
    setRows((rs) => {
      const blankIdx = rs.findIndex((r) => r.kind === 'expr' && !r.text.trim());
      const color = PALETTE[rs.filter((r) => r.kind === 'expr' && r.text.trim()).length % PALETTE.length];
      if (blankIdx >= 0) return rs.map((r, i) => (i === blankIdx ? { ...r, text, color } : r));
      return [...rs, { id: newId(), kind: 'expr', text, color }];
    });
  }, []);
  useImperativeHandle(apiRef, () => ({
    addRow,
    typeRow: async (text: string) => {
      const ticket = ++typing.current;
      const id = newId();
      const color =
        PALETTE[
          stateRef.current.rows.filter((r) => r.kind === 'expr' && r.text.trim()).length % PALETTE.length
        ];
      setRows((rs) => [
        ...rs.filter((r) => !(r.kind === 'expr' && !r.text.trim())),
        { id, kind: 'expr', text: '', color },
      ]);
      for (let i = 1; i <= text.length; i++) {
        await new Promise((r) => setTimeout(r, 55));
        if (!alive.current || ticket !== typing.current) return;
        setRows((rs) => rs.map((r) => (r.id === id ? { ...r, text: text.slice(0, i) } : r)));
      }
    },
    setSlider: (name: string, v: number) =>
      setRows((rs) =>
        rs.map((r) =>
          r.kind === 'expr' && new RegExp(`^\\s*${name}\\s*=`).test(r.text)
            ? { ...r, text: `${name}=${v}` }
            : r,
        ),
      ),
    focusPoint: (x: number, y: number) => setView((v) => ({ ...v, cx: x, cy: y })),
    getState: () => stateRef.current,
  }));

  // ———— sizing ————
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ———— drawing ————
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(size.w * dpr);
    cv.height = Math.round(size.h * dpr);
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const host = wrapRef.current!;
    const color = (value: string) => (value.startsWith('var(') ? cssVar(host, value.slice(4, -1)) : value);
    const cGrid = cssVar(host, '--c-graph-grid'),
      cGrid2 = cssVar(host, '--c-graph-grid-2'),
      cAxis = cssVar(host, '--c-graph-axis');
    const cBg = cssVar(host, '--c-paper'),
      cInk3 = cssVar(host, '--c-ink-3');
    ctx.fillStyle = cBg;
    ctx.fillRect(0, 0, size.w, size.h);

    const major = niceStep(80 / view.scale);
    const minor = major / (String(major).startsWith('2') ? 4 : 5);
    const y0 = toWY(size.h),
      y1 = toWY(0);
    const lines = (step: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) {
        const sx = Math.round(toSX(x)) + 0.5;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, size.h);
      }
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) {
        const sy = Math.round(toSY(y)) + 0.5;
        ctx.moveTo(0, sy);
        ctx.lineTo(size.w, sy);
      }
      ctx.stroke();
    };
    lines(minor, cGrid);
    lines(major, cGrid2);
    // axes
    ctx.strokeStyle = cAxis;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const ax = toSX(0),
      ay = toSY(0);
    ctx.moveTo(ax, 0);
    ctx.lineTo(ax, size.h);
    ctx.moveTo(0, ay);
    ctx.lineTo(size.w, ay);
    ctx.stroke();
    // labels
    ctx.fillStyle = cInk3;
    ctx.font = '11px Onest, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const ly = Math.min(Math.max(ay + 4, 4), size.h - 16);
    for (let x = Math.ceil(x0 / major) * major; x <= x1; x += major) {
      if (Math.abs(x) < major / 2) continue;
      ctx.fillText(fmt(x, 4), toSX(x), ly);
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const lx = Math.min(Math.max(ax - 5, 26), size.w - 4);
    for (let y = Math.ceil(y0 / major) * major; y <= y1; y += major) {
      if (Math.abs(y) < major / 2) continue;
      ctx.fillText(fmt(y, 4), lx, toSY(y));
    }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    if (ax > 0 && ay > 0 && ax < size.w && ay < size.h) ctx.fillText('0', ax - 5, ay + 4);

    const drawFunc = (f: (x: number) => number, color: string, rel: string, isSel: boolean) => {
      const pts: (number | null)[] = [];
      for (let sx = -1; sx <= size.w + 1; sx += 1) {
        const y = f(toWX(sx));
        pts.push(Number.isFinite(y) ? toSY(y) : null);
      }
      if (rel !== '=') {
        ctx.save();
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = color;
        ctx.beginPath();
        const above = rel === '>' || rel === '>=';
        let started = false;
        pts.forEach((sy, i) => {
          const sx = i - 1;
          const yy = sy === null ? (above ? size.h : 0) : Math.max(-10, Math.min(size.h + 10, sy));
          if (!started) {
            ctx.moveTo(sx, above ? 0 : size.h);
            started = true;
          }
          ctx.lineTo(sx, yy);
        });
        ctx.lineTo(size.w + 1, above ? 0 : size.h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = isSel ? 3.6 : 2.6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.setLineDash(rel === '<' || rel === '>' ? [9, 7] : []);
      ctx.beginPath();
      let pen = false,
        prev: number | null = null;
      pts.forEach((sy, i) => {
        const sx = i - 1;
        if (sy === null || (prev !== null && Math.abs(sy - prev) > size.h * 1.5)) {
          pen = false;
          prev = sy;
          return;
        }
        const cy = Math.max(-1e4, Math.min(1e4, sy));
        if (!pen) {
          ctx.moveTo(sx, cy);
          pen = true;
        } else ctx.lineTo(sx, cy);
        prev = sy;
      });
      ctx.stroke();
      ctx.setLineDash([]);
    };

    plotRows.rows.forEach((r, i) => {
      const p = plotRows.parsed[i];
      if (r.hidden) return;
      const base = r.id.replace(':reg', '');
      const isSel = base === selected;
      if (p.kind === 'func') drawFunc((x) => p.f(x, env), color(r.color), p.rel, isSel);
      else if (p.kind === 'vline') {
        const c = p.c(env);
        if (!Number.isFinite(c)) return;
        const sx = toSX(c);
        if (p.rel !== '=') {
          ctx.save();
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = color(r.color);
          const right = p.rel === '>' || p.rel === '>=';
          ctx.fillRect(right ? sx : 0, 0, right ? size.w - sx : sx, size.h);
          ctx.restore();
        }
        ctx.strokeStyle = color(r.color);
        ctx.lineWidth = isSel ? 3.6 : 2.6;
        ctx.setLineDash(p.rel === '<' || p.rel === '>' ? [9, 7] : []);
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, size.h);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (p.kind === 'implicit') {
        // Even-multiplicity x-only roots never change sign, so marching
        // squares cannot see x²=0. Draw its numerically isolated roots as lines.
        if (p.xOnly) {
          ctx.strokeStyle = color(r.color);
          ctx.lineWidth = isSel ? 3.4 : 2.6;
          ctx.beginPath();
          for (const poi of allPois) {
            if (poi.kind !== 'root' || !poi.rows.includes(r.id)) continue;
            ctx.moveTo(toSX(poi.x), 0);
            ctx.lineTo(toSX(poi.x), size.h);
          }
          ctx.stroke();
          return;
        }
        const step = 5;
        const nx = Math.ceil(size.w / step) + 1,
          ny = Math.ceil(size.h / step) + 1;
        const g = new Float64Array(nx * ny);
        for (let j = 0; j < ny; j++)
          for (let k = 0; k < nx; k++) g[j * nx + k] = p.F(toWX(k * step), toWY(j * step), env);
        ctx.strokeStyle = color(r.color);
        ctx.lineWidth = isSel ? 3.4 : 2.6;
        ctx.beginPath();
        const lerp = (a: number, b: number) => a / (a - b);
        for (let j = 0; j < ny - 1; j++)
          for (let k = 0; k < nx - 1; k++) {
            const a = g[j * nx + k],
              b = g[j * nx + k + 1],
              c = g[(j + 1) * nx + k + 1],
              d = g[(j + 1) * nx + k];
            if (![a, b, c, d].every(Number.isFinite)) continue;
            const X = k * step,
              Y = j * step;
            const e: [number, number][] = [];
            if (a * b < 0) e.push([X + lerp(a, b) * step, Y]);
            if (b * c < 0) e.push([X + step, Y + lerp(b, c) * step]);
            if (d * c < 0) e.push([X + lerp(d, c) * step, Y + step]);
            if (a * d < 0) e.push([X, Y + lerp(a, d) * step]);
            if (e.length >= 2) {
              ctx.moveTo(e[0][0], e[0][1]);
              ctx.lineTo(e[1][0], e[1][1]);
            }
            if (e.length === 4) {
              ctx.moveTo(e[2][0], e[2][1]);
              ctx.lineTo(e[3][0], e[3][1]);
            }
          }
        ctx.stroke();
      } else if (p.kind === 'point') {
        const x = evaluate(p.px, env),
          y = evaluate(p.py, env);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        ctx.fillStyle = color(r.color);
        ctx.beginPath();
        ctx.arc(toSX(x), toSY(y), 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cAxis;
        ctx.font = '600 12px Onest, system-ui';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fmtPoint(x, y), toSX(x) + 8, toSY(y) - 6);
      } else if (p.kind === 'table') {
        ctx.fillStyle = color(r.color);
        p.points.forEach(([x, y]) => {
          ctx.beginPath();
          ctx.arc(toSX(x), toSY(y), 5, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });

    // POIs
    visiblePois.forEach((p) => {
      if (p.kind === 'point') return;
      const sx = toSX(p.x),
        sy = toSY(p.y);
      const hov = hoverPoi && hoverPoi.x === p.x && hoverPoi.y === p.y;
      ctx.beginPath();
      ctx.arc(sx, sy, hov ? 7 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle = cBg;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = cInk3;
      ctx.stroke();
    });
    pinned.forEach((p) => {
      ctx.beginPath();
      ctx.arc(toSX(p.x), toSY(p.y), 6, 0, Math.PI * 2);
      ctx.fillStyle = cInk3;
      ctx.fill();
    });
    if (trace) {
      ctx.beginPath();
      ctx.arc(toSX(trace.x), toSY(trace.y), 5, 0, Math.PI * 2);
      ctx.fillStyle = color(trace.color);
      ctx.fill();
    }
  });

  // ———— pointer interaction ————
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean; id: number } | null>(
    null,
  );
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; scale: number } | null>(null);
  const local = (e: React.PointerEvent | React.WheelEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const hitPoi = (x: number, y: number) => findHitPoi(visiblePois, x, y, view, size);
  const hitCurve = (x: number, y: number): string | null => {
    const wx = toWX(x);
    const best: { id: string | null; d: number } = { id: null, d: Infinity };
    plotRows.rows.forEach((r, i) => {
      const p = plotRows.parsed[i];
      if (r.hidden) return;
      let d = Infinity;
      if (p.kind === 'func') {
        // vertical distance, adjusted for slope
        const fy = p.f(wx, env),
          fy2 = p.f(wx + 1 / view.scale, env);
        if (Number.isFinite(fy)) {
          const slope = Number.isFinite(fy2) ? (fy2 - fy) * view.scale : 0;
          d = Math.abs(toSY(fy) - y) / Math.sqrt(1 + slope * slope);
        }
      } else if (p.kind === 'vline') d = Math.abs(toSX(p.c(env)) - x);
      else if (p.kind === 'implicit') {
        const v = p.F(wx, toWY(y), env),
          gx = (p.F(wx + 0.01, toWY(y), env) - v) / 0.01,
          gy = (p.F(wx, toWY(y) + 0.01, env) - v) / 0.01;
        d = (Math.abs(v) / (Math.hypot(gx, gy) || 1)) * view.scale;
      }
      if (d < 12 && d < best.d) {
        best.id = r.id.replace(':reg', '');
        best.d = d;
      }
    });
    return best.id;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), scale: view.scale };
      drag.current = null;
      return;
    }
    drag.current = { x: p.x, y: p.y, cx: view.cx, cy: view.cy, moved: false, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const p = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, p);
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      setView((v) => ({
        ...v,
        scale: Math.max(2, Math.min(4000, (pinch.current!.scale * d) / pinch.current!.d)),
      }));
      return;
    }
    const dr = drag.current;
    if (dr && dr.id === e.pointerId) {
      const dx = p.x - dr.x,
        dy = p.y - dr.y;
      if (!dr.moved && Math.hypot(dx, dy) > 4) dr.moved = true;
      if (dr.moved) {
        setView((v) => ({ ...v, cx: dr.cx - dx / v.scale, cy: dr.cy + dy / v.scale }));
        setTrace(null);
      }
      return;
    }
    // hover
    const hp = hitPoi(p.x, p.y);
    setHoverPoi(hp || null);
    if (!hp && selected) {
      const i = plotRows.rows.findIndex((r) => r.id === selected);
      const pr = plotRows.parsed[i];
      if (pr && pr.kind === 'func') {
        const wx = toWX(p.x),
          wy = pr.f(wx, env);
        if (Number.isFinite(wy) && Math.abs(toSY(wy) - p.y) < 28)
          setTrace({ x: wx, y: wy, color: plotRows.rows[i].color });
        else setTrace(null);
      }
    } else setTrace(null);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) {
        pinch.current = null;
        onView?.('zoom');
      }
      return;
    }
    const dr = drag.current;
    drag.current = null;
    if (!dr) return;
    if (dr.moved) {
      onView?.('pan');
      return;
    }
    const p = local(e);
    const hp = hitPoi(p.x, p.y);
    if (hp) {
      setPinned((ps) =>
        ps.some((q) => q.x === hp.x && q.y === hp.y)
          ? ps.filter((q) => !(q.x === hp.x && q.y === hp.y))
          : [...ps, hp],
      );
      onPoi?.(hp);
      return;
    }
    const c = hitCurve(p.x, p.y);
    setSelected(c);
    if (!c) setPinned([]);
  };
  const zoomBy = (k: number, at?: { x: number; y: number }) => {
    setView((v) => {
      const s = Math.max(2, Math.min(4000, v.scale * k));
      if (!at) return { ...v, scale: s };
      const wx = v.cx + (at.x - size.w / 2) / v.scale,
        wy = v.cy - (at.y - size.h / 2) / v.scale;
      return { scale: s, cx: wx - (at.x - size.w / 2) / s, cy: wy + (at.y - size.h / 2) / s };
    });
  };
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(wheelTimer.current), []);
  useEffect(() => {
    const cv = canvasRef.current!;
    const h = (e: WheelEvent) => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomBy(Math.exp(-e.deltaY * 0.0016), { x: e.clientX - r.left, y: e.clientY - r.top });
      clearTimeout(wheelTimer.current);
      wheelTimer.current = setTimeout(() => onView?.('zoom'), 180);
    };
    cv.addEventListener('wheel', h, { passive: false });
    return () => {
      cv.removeEventListener('wheel', h);
    };
  });

  // ———— row editing ————
  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? ({ ...r, ...patch } as Row) : r)));
  const removeRow = (id: string) => {
    setRows((rs) => {
      const next = rs.filter((r) => r.id !== id);
      return next.length ? next : [{ id: newId(), kind: 'expr', text: '', color: PALETTE[0] }];
    });
    if (selected === id) setSelected(null);
  };
  const addBlank = (after?: string) => {
    const id = newId();
    setRows((rs) => {
      const color = PALETTE[rs.length % PALETTE.length];
      const idx = after ? rs.findIndex((r) => r.id === after) + 1 : rs.length;
      const next = [...rs];
      next.splice(idx, 0, { id, kind: 'expr', text: '', color });
      return next;
    });
    setTimeout(() => inputs.current[id]?.focus(), 30);
  };
  const addTable = () => {
    setRows((rs) => [
      ...rs,
      { id: newId(), kind: 'table', xs: ['', ''], ys: ['', ''], color: PALETTE[rs.length % PALETTE.length] },
    ]);
    setAddOpen(false);
  };
  const addSlider = (name: string) =>
    setRows((rs) => [
      ...rs,
      { id: newId(), kind: 'expr', text: `${name}=1`, color: PALETTE[rs.length % PALETTE.length] },
    ]);
  const insert = (s: string) => {
    const id = focusId || rows.find((r) => r.kind === 'expr')?.id;
    if (!id) return;
    const el = inputs.current[id];
    const row = rows.find((r) => r.id === id);
    if (!el || !row || row.kind !== 'expr') return;
    const a = el.selectionStart ?? row.text.length,
      b = el.selectionEnd ?? a;
    let text: string, caret: number;
    if (s === '⌫') {
      text = row.text.slice(0, Math.max(0, a - (a === b ? 1 : 0))) + row.text.slice(b);
      caret = Math.max(0, a - (a === b ? 1 : 0));
    } else {
      text = row.text.slice(0, a) + s + row.text.slice(b);
      caret = a + s.length;
    }
    updateRow(id, { text });
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    }, 0);
  };

  const home = () => {
    setView(initialView);
    onView?.('home');
  };
  const poiLabel = (p: Poi) => fmtPoint(p.x, p.y);

  return (
    <div className="@container h-full">
      <div
        className="flex flex-col @xl:flex-row h-full rounded-2xl overflow-hidden border border-line bg-paper"
        style={{ minHeight: typeof height === 'number' ? height : undefined, height }}
      >
        {/* expression list */}
        {!hideList && (
          <div
            className="flex flex-col border-b @xl:border-b-0 @xl:border-r border-line bg-paper shrink-0 max-h-[46%] @xl:max-h-none w-full @xl:w-[var(--lw)]"
            style={{ '--lw': `${listWidth}px` } as CSSProperties}
          >
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-line bg-paper-2/60 relative">
              <button
                type="button"
                onClick={() => setAddOpen((o) => !o)}
                className="h-8 w-8 grid place-items-center rounded-lg hover:bg-paper text-ink-2"
                aria-label={t('ui.add_row')}
                title={t('ui.add')}
              >
                <LuPlus size={18} />
              </button>
              {addOpen && (
                <div className="absolute left-2 top-10 z-20 card p-1 w-44 anim-pop">
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-paper-2 text-sm"
                    onClick={() => {
                      addBlank();
                      setAddOpen(false);
                    }}
                  >
                    <LuSquareFunction /> {t('ui.expression')}
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-paper-2 text-sm"
                    onClick={addTable}
                  >
                    <LuTable /> {t('ui.table')}
                  </button>
                </div>
              )}
              <span className="text-[11px] font-semibold text-ink-3 tracking-wide ml-1 truncate">
                {label || t('ui.suuprep_graphing_calculator')}
              </span>
              <div className="ml-auto flex items-center">
                <button
                  type="button"
                  onClick={() => setKeypad((k) => !k)}
                  className={`h-8 w-8 grid place-items-center rounded-lg ${keypad ? 'bg-sage text-leaf' : 'hover:bg-paper text-ink-2'}`}
                  aria-label={t('ui.keypad')}
                  title={t('ui.math_keypad')}
                >
                  <LuKeyboard size={17} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto scroll-thin flex-1">
              {rows.map((r, i) => (
                <RowView
                  key={r.id}
                  idx={i + 1}
                  row={r}
                  parsed={parsed[i]}
                  env={env}
                  selected={selected === r.id}
                  focused={focusId === r.id}
                  inputRef={(el) => {
                    inputs.current[r.id] = el;
                  }}
                  onFocus={() => {
                    setFocusId(r.id);
                    setSelected(r.id);
                  }}
                  onBlur={() => setFocusId((f) => (f === r.id ? null : f))}
                  onChange={(patch) => updateRow(r.id, patch)}
                  onRemove={() => removeRow(r.id)}
                  onEnter={() => addBlank(r.id)}
                />
              ))}
              <button
                type="button"
                onClick={() => addBlank()}
                className="w-full text-left px-4 py-3 text-sm text-ink-3 hover:bg-paper-2/60 border-b border-line"
              >
                {t('ui.new_row')}
              </button>
              {missing.length > 0 && (
                <div className="px-3 py-2.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-2 border-b border-line bg-amber-soft/50">
                  <span>{t('ui.add_slider')}</span>
                  {missing.map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => addSlider(m)}
                      className="px-2 py-0.5 rounded-md border border-line-2 bg-paper font-semibold hover:border-leaf"
                    >
                      {m}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => missing.forEach(addSlider)}
                    className="px-2 py-0.5 rounded-md bg-leaf text-white font-semibold"
                  >
                    {t('ui.all')}
                  </button>
                </div>
              )}
            </div>
            {keypad && (
              <div className="grid grid-cols-8 gap-1 p-2 border-t border-line bg-paper-2/70">
                {['x', 'y', '^', '²', '(', ')', '√', '⌫', '≤', '≥', '<', '>', '=', 'π', ',', '/'].map((k) => (
                  <button
                    type="button"
                    key={k}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => insert(k === '√' ? 'sqrt(' : k === '²' ? '^2' : k)}
                    className="h-9 rounded-lg bg-paper border border-line text-sm font-semibold hover:border-leaf"
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {/* canvas */}
        <div ref={wrapRef} className="relative flex-1 min-h-[240px] touch-none select-none">
          <canvas
            ref={canvasRef}
            data-testid="graph-canvas"
            onPointerCancel={() => {
              pointers.current.clear();
              pinch.current = null;
              drag.current = null;
            }}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: hoverPoi ? 'pointer' : drag.current?.moved ? 'grabbing' : 'grab' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={() => {
              setHoverPoi(null);
              setTrace(null);
            }}
            aria-label={t('ui.graph_drag_to_pan_scroll_to_zoom')}
            role="img"
          />
          {/* labels */}
          {pinned.map((p) => (
            <div
              key={`${p.x},${p.y}`}
              className="absolute pointer-events-none anim-pop"
              style={{ left: toSX(p.x) + 10, top: toSY(p.y) - 38 }}
            >
              <div className="rounded-lg bg-ink text-paper px-2 py-1 text-[13px] font-semibold tnum shadow-pop whitespace-nowrap">
                {poiLabel(p)}
              </div>
            </div>
          ))}
          {hoverPoi && !pinned.some((q) => q.x === hoverPoi.x && q.y === hoverPoi.y) && (
            <div
              className="absolute pointer-events-none"
              style={{ left: toSX(hoverPoi.x) + 10, top: toSY(hoverPoi.y) - 52 }}
            >
              <div className="rounded-lg bg-paper border border-line px-2 py-1 text-xs shadow-card whitespace-nowrap">
                <div className="text-ink-3 text-[10px]">{t(POI_LABEL_KEY[hoverPoi.kind])}</div>
                <div className="font-semibold tnum">{poiLabel(hoverPoi)}</div>
              </div>
            </div>
          )}
          {trace && (
            <div
              className="absolute pointer-events-none"
              style={{ left: toSX(trace.x) + 10, top: toSY(trace.y) + 8 }}
            >
              <div className="rounded-md bg-paper/90 border border-line px-1.5 py-0.5 text-[11px] tnum text-ink-2">
                {fmtPoint(trace.x, trace.y)}
              </div>
            </div>
          )}
          {highlight && (
            <div
              className="absolute pointer-events-none"
              style={{ left: toSX(highlight.x) - 14, top: toSY(highlight.y) - 14 }}
            >
              <div className="w-7 h-7 rounded-full border-2 border-leaf pulse-ring" />
            </div>
          )}
          <div className="absolute right-2 top-2 flex flex-col gap-1">
            {[
              {
                i: <LuPlus />,
                a: () => {
                  zoomBy(1.4);
                  onView?.('zoom');
                },
                l: t('ui.zoom_in'),
              },
              {
                i: <LuMinus />,
                a: () => {
                  zoomBy(1 / 1.4);
                  onView?.('zoom');
                },
                l: t('ui.zoom_out'),
              },
              { i: <LuHouse />, a: home, l: t('ui.reset_view') },
            ].map((b) => (
              <button
                type="button"
                key={b.l}
                onClick={b.a}
                aria-label={b.l}
                title={b.l}
                className="h-9 w-9 grid place-items-center rounded-lg bg-paper/95 border border-line shadow-card text-ink-2 hover:text-leaf hover:border-leaf"
              >
                {b.i}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RowView({
  idx,
  row,
  parsed,
  env,
  selected,
  focused,
  inputRef,
  onFocus,
  onBlur,
  onChange,
  onRemove,
  onEnter,
}: {
  idx: number;
  row: Row;
  parsed: Parsed;
  env: Record<string, number>;
  selected: boolean;
  focused: boolean;
  inputRef: (el: HTMLInputElement | null) => void;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (p: Partial<Row>) => void;
  onRemove: () => void;
  onEnter: () => void;
}) {
  const t = useT('desmos');
  const element = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (focused) element.current?.focus();
  }, [focused]);
  const showTex = !focused && row.kind === 'expr' && row.text.trim() && 'tex' in parsed;
  return (
    <div className={`group flex border-b border-line ${selected ? 'bg-sage/40' : ''}`}>
      <div className="w-11 shrink-0 flex flex-col items-center pt-2 gap-1 border-r border-line bg-paper-2/40 text-[10px] text-ink-3">
        <span>{idx}</span>
        {(row.kind === 'table' ||
          (parsed.kind !== 'empty' && parsed.kind !== 'value' && parsed.kind !== 'slider')) && (
          <button
            type="button"
            onClick={() => onChange({ hidden: !row.hidden })}
            aria-label={row.hidden ? t('ui.show') : t('ui.hide')}
            title={row.hidden ? t('ui.show') : t('ui.hide')}
            className="h-6 w-6 rounded-full grid place-items-center border-2"
            style={{
              borderColor: row.color,
              background: row.hidden ? 'transparent' : row.color,
              color: 'var(--c-on-leaf)',
            }}
          >
            {row.hidden ? <LuEyeOff size={11} color={row.color} /> : <LuEye size={11} />}
          </button>
        )}
        {parsed.kind === 'error' && <LuTriangleAlert size={16} className="text-amber" />}
      </div>
      <div className="flex-1 min-w-0 py-1.5 pl-2.5 pr-1">
        {row.kind === 'expr' ? (
          <>
            {showTex ? (
              <button
                type="button"
                aria-label={t('ui.expression_value_value', { v0: idx, v1: row.text })}
                className="w-full text-left min-h-[34px] px-1 py-1 overflow-x-auto no-scrollbar"
                onClick={onFocus}
              >
                <Tex tex={'tex' in parsed ? parsed.tex : ''} />
              </button>
            ) : (
              <input
                ref={(el) => {
                  element.current = el;
                  inputRef(el);
                }}
                value={row.text}
                onFocus={onFocus}
                onBlur={onBlur}
                onChange={(e) => onChange({ text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onEnter();
                }}
                aria-label={t('ui.expression_value', { v0: idx })}
                placeholder={idx === 1 ? t('ui.e_g_y_2x_1') : ''}
                spellCheck={false}
                autoComplete="off"
                data-testid={`expression-${idx}`}
                id={`expr-${row.id}`}
                className="w-full bg-transparent outline-none px-1 py-1.5 font-[KaTeX_Main,serif] text-[17px] text-ink placeholder:text-ink-3 placeholder:font-sans placeholder:text-sm"
              />
            )}
            {parsed.kind === 'error' && row.text.trim() && (
              <div className="text-[11px] text-amber px-1 pb-1">{parsed.message}</div>
            )}
            {parsed.kind === 'value' && (
              <div className="text-right pr-2 text-ink-2 tnum text-sm">
                = {fmt(evaluate(parsed.n, env), 6)}
              </div>
            )}
            {parsed.kind === 'slider' && (
              <div className="flex items-center gap-2 px-1 pb-1">
                <span className="text-[10px] text-ink-3 tnum">-10</span>
                <input
                  type="range"
                  min={-10}
                  max={10}
                  step={0.1}
                  value={parsed.value}
                  onChange={(e) =>
                    onChange({ text: `${parsed.name}=${+parseFloat(e.target.value).toFixed(1)}` })
                  }
                  className="flex-1 accent-[var(--c-leaf)]"
                  aria-label={t('ui.value_slider', { v0: parsed.name })}
                  id={`slider-${row.id}`}
                />
                <span className="text-[10px] text-ink-3 tnum">10</span>
              </div>
            )}
          </>
        ) : (
          <TableEditor row={row} parsed={parsed} onChange={onChange} />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="opacity-40 group-hover:opacity-100 px-2 text-ink-3 hover:text-danger"
        aria-label={t('ui.delete')}
        title={t('ui.delete')}
      >
        <LuX size={16} />
      </button>
    </div>
  );
}

function TableEditor({
  row,
  parsed,
  onChange,
}: {
  row: Extract<Row, { kind: 'table' }>;
  parsed: Parsed;
  onChange: (p: Partial<Row>) => void;
}) {
  const t = useT('desmos');
  const setCellVal = (col: 'xs' | 'ys', i: number, v: string) => {
    const xs = [...row.xs],
      ys = [...row.ys];
    (col === 'xs' ? xs : ys)[i] = v;
    if (i === xs.length - 1 && (xs[i] || ys[i])) {
      xs.push('');
      ys.push('');
    }
    onChange({ xs, ys });
  };
  const reg = parsed.kind === 'table' ? parsed.reg : undefined;
  return (
    <div className="pr-1">
      <table className="text-sm tnum border border-line-2 rounded-md overflow-hidden">
        <thead>
          <tr className="bg-paper-2">
            <th className="px-3 py-1 font-[KaTeX_Main,serif] italic font-normal border-r border-line-2 w-20">
              x₁
            </th>
            <th className="px-3 py-1 font-[KaTeX_Main,serif] italic font-normal w-20">y₁</th>
          </tr>
        </thead>
        <tbody>
          {row.xs.map((x: string, i: number) => (
            <tr key={i} className="border-t border-line-2">
              <td className="border-r border-line-2">
                <input
                  id={`t-${row.id}-x${i}`}
                  aria-label={`x ${i + 1}`}
                  value={x}
                  onChange={(e) => setCellVal('xs', i, e.target.value)}
                  className="w-20 px-2 py-1 bg-transparent outline-none focus:bg-sage/40"
                  inputMode="decimal"
                />
              </td>
              <td>
                <input
                  id={`t-${row.id}-y${i}`}
                  aria-label={`y ${i + 1}`}
                  value={row.ys[i]}
                  onChange={(e) => setCellVal('ys', i, e.target.value)}
                  className="w-20 px-2 py-1 bg-transparent outline-none focus:bg-sage/40"
                  inputMode="decimal"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <label className="flex items-center gap-2 mt-2 text-xs text-ink-2 cursor-pointer">
        <input
          type="checkbox"
          id={`reg-${row.id}`}
          checked={!!row.regression}
          onChange={(e) => onChange({ regression: e.target.checked })}
          className="accent-[var(--c-leaf)]"
        />
        {t('ui.linear_regression')}
        <Tex tex={String.raw`y_1\sim mx_1+b`} />
      </label>
      {reg && (
        <div className="mt-1.5 text-xs text-ink-2 grid grid-cols-3 gap-1 tnum">
          <span>
            m = <b className="text-ink">{fmt(reg.m)}</b>
          </span>
          <span>
            b = <b className="text-ink">{fmt(reg.b)}</b>
          </span>
          <span>
            R² = <b className="text-ink">{fmt(reg.r2, 4)}</b>
          </span>
        </div>
      )}
    </div>
  );
}
