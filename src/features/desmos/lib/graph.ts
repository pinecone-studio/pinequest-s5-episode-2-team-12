// Graph model: turns typed rows into plottable objects, finds points of interest
// (roots, y-intercepts, extrema, intersections) and checks equivalence for lessons.
import {
  type Env,
  evaluate,
  fmt,
  type Node,
  parseExpr,
  REL_TEX,
  type RelOp,
  splitRelation,
  toTex,
  vars,
} from './expr';
import { mathMessage } from './math-messages';

export type Row =
  | { id: string; kind: 'expr'; text: string; color: string; hidden?: boolean }
  | {
      id: string;
      kind: 'table';
      xs: string[];
      ys: string[];
      color: string;
      regression?: boolean;
      hidden?: boolean;
    };

export type Parsed =
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'func'; f: (x: number, env: Env) => number; rel: RelOp; tex: string; deps: Set<string> }
  | { kind: 'vline'; c: (env: Env) => number; rel: RelOp; tex: string; deps: Set<string> }
  | {
      kind: 'implicit';
      F: (x: number, y: number, env: Env) => number;
      xOnly?: boolean;
      tex: string;
      deps: Set<string>;
    }
  | { kind: 'point'; px: Node; py: Node; tex: string; deps: Set<string> }
  | { kind: 'slider'; name: string; value: number; tex: string }
  | { kind: 'value'; n: Node; tex: string; deps: Set<string> }
  | { kind: 'table'; points: [number, number][]; reg?: { m: number; b: number; r2: number } };

export const PALETTE = [
  'var(--c-leaf)',
  'var(--c-rose)',
  'var(--c-teal)',
  'var(--c-moss)',
  'var(--c-amber)',
  'var(--c-ink-3)',
];
const RESERVED = new Set(['x', 'y']);

const flip: Record<RelOp, RelOp> = { '=': '=', '<': '>', '>': '<', '<=': '>=', '>=': '<=' };

/** Conservative polynomial degree: a nonlinear call/divisor is never guessed linear. */
function degreeIn(n: Node, name: string): number {
  if (!vars(n).has(name)) return 0;
  if (n.t === 'var') return 1;
  if (n.t === 'neg') return degreeIn(n.a, name);
  if (n.t !== 'bin') return Infinity;
  const a = degreeIn(n.a, name),
    b = degreeIn(n.b, name);
  if (n.op === '+' || n.op === '-') return Math.max(a, b);
  if (n.op === '*') return a + b;
  if (n.op === '/') return b === 0 ? a : Infinity;
  return n.b.t === 'num' && Number.isInteger(n.b.v) && n.b.v >= 0 ? a * n.b.v : Infinity;
}

export function parseRow(row: Row): Parsed {
  if (row.kind === 'table') return parseTable(row);
  const text = row.text.trim();
  if (!text) return { kind: 'empty' };
  try {
    // point (a, b)
    const pm = text.replace(/\s/g, '').match(/^\((.+),(.+)\)$/);
    if (pm && !/[=<>]/.test(text)) {
      const px = parseExpr(pm[1]),
        py = parseExpr(pm[2]);
      const deps = new Set([...vars(px), ...vars(py)]);
      return { kind: 'point', px, py, tex: `\\left(${toTex(px)},\\ ${toTex(py)}\\right)`, deps };
    }
    const rel = splitRelation(text);
    if (!rel) {
      const n = parseExpr(text);
      const deps = vars(n);
      if (deps.has('y'))
        return { kind: 'error', message: mathMessage('ui.an_expression_with_y_needs_an_equals_sign') };
      if (!deps.has('x')) {
        return { kind: 'value', n, tex: toTex(n), deps };
      }
      deps.delete('x');
      return {
        kind: 'func',
        f: (x, env) => evaluate(n, { ...env, x }),
        rel: '=',
        tex: `y=${toTex(n)}`,
        deps,
      };
    }
    const { lhs, op, rhs } = rel;
    const L = parseExpr(lhs),
      R = parseExpr(rhs);
    const lv = vars(L),
      rv = vars(R);
    const tex = `${toTex(L)}${REL_TEX[op]}${toTex(R)}`;
    // slider definition a = 3
    if (op === '=' && L.t === 'var' && !RESERVED.has(L.name) && rv.size === 0) {
      return { kind: 'slider', name: L.name, value: evaluate(R, {}), tex };
    }
    // f(x) = … style
    const fx = lhs.match(/^[a-wz]\(x\)$/);
    if (fx && op === '=' && !rv.has('y')) {
      const deps = new Set(rv);
      deps.delete('x');
      return {
        kind: 'func',
        f: (x, env) => evaluate(R, { ...env, x }),
        rel: '=',
        tex: `${lhs[0]}\\left(x\\right)=${toTex(R)}`,
        deps,
      };
    }
    // y = f(x)
    if (L.t === 'var' && L.name === 'y' && !rv.has('y')) {
      const deps = new Set(rv);
      deps.delete('x');
      return { kind: 'func', f: (x, env) => evaluate(R, { ...env, x }), rel: op, tex, deps };
    }
    if (R.t === 'var' && R.name === 'y' && !lv.has('y')) {
      const deps = new Set(lv);
      deps.delete('x');
      return { kind: 'func', f: (x, env) => evaluate(L, { ...env, x }), rel: flip[op], tex, deps };
    }
    // x = c
    if (L.t === 'var' && L.name === 'x' && !rv.has('x') && !rv.has('y')) {
      return { kind: 'vline', c: (env) => evaluate(R, env), rel: op, tex, deps: rv };
    }
    const all = new Set([...lv, ...rv]);
    const F = (x: number, y: number, env: Env) =>
      evaluate(L, { ...env, x, y }) - evaluate(R, { ...env, x, y });
    const deps = new Set(all);
    deps.delete('x');
    deps.delete('y');
    if (!all.has('x') && !all.has('y')) {
      return { kind: 'error', message: mathMessage('ui.this_equation_has_no_x_or_y') };
    }
    // linear in y → solve for y (handles 3x + 2y = 16, x − y = 2 …)
    if (all.has('y')) {
      const probe: Env = Object.fromEntries([...deps].map((name) => [name, 1]));
      let linear = degreeIn(L, 'y') <= 1 && degreeIn(R, 'y') <= 1,
        coefConst = true;
      let c0 = NaN;
      for (const x of [-2.3, 0.7, 3.1]) {
        const f0 = F(x, 0, probe),
          f1 = F(x, 1, probe),
          f2 = F(x, 2, probe),
          f5 = F(x, -5, probe);
        if (Math.abs(f2 - f1 - (f1 - f0)) > 1e-7 || Math.abs((f0 - f5) / 5 - (f1 - f0)) > 1e-7)
          linear = false;
        const c = f1 - f0;
        if (!Number.isNaN(c0) && Math.abs(c - c0) > 1e-9) coefConst = false;
        c0 = c;
      }
      if (linear && coefConst && Math.abs(c0) > 1e-12 && (op === '=' || deps.size === 0)) {
        const f = (x: number, env: Env) => {
          const f0 = F(x, 0, env),
            c = F(x, 1, env) - f0;
          return -f0 / c;
        };
        // dividing by a negative y-coefficient flips the inequality
        const sign = c0 > 0 ? 1 : -1;
        const r: RelOp = sign > 0 ? op : flip[op];
        // F < 0  ⇔  c·y + f0 < 0  ⇔  y < −f0/c (c>0)
        return { kind: 'func', f, rel: r, tex, deps };
      }
      if (op !== '=')
        return { kind: 'error', message: mathMessage('ui.rewrite_this_inequality_in_terms_of_y') };
      return { kind: 'implicit', F, tex, deps };
    }
    // only x: vertical line(s); support linear in x
    const g = (x: number, env: Env) => F(x, 0, env);
    const p: Env = Object.fromEntries([...deps].map((name) => [name, 1]));
    const d1 = g(1, p) - g(0, p),
      d2 = g(2, p) - g(1, p);
    if (
      degreeIn(L, 'x') <= 1 &&
      degreeIn(R, 'x') <= 1 &&
      Math.abs(d1 - d2) < 1e-9 &&
      Math.abs(d1) > 1e-12 &&
      (op === '=' || deps.size === 0)
    ) {
      const sign = d1 > 0 ? 1 : -1;
      return {
        kind: 'vline',
        c: (env) => -g(0, env) / (g(1, env) - g(0, env)),
        rel: sign > 0 ? op : flip[op],
        tex,
        deps,
      };
    }
    if (op !== '=')
      return { kind: 'error', message: mathMessage('ui.rewrite_this_inequality_in_terms_of_x') };
    return { kind: 'implicit', F, xOnly: true, tex, deps };
  } catch (e: unknown) {
    return {
      kind: 'error',
      message: e instanceof Error ? e.message : mathMessage('ui.could_not_understand'),
    };
  }
}

function parseTable(row: Extract<Row, { kind: 'table' }>): Parsed {
  const points: [number, number][] = [];
  row.xs.forEach((xs, i) => {
    if (!xs.trim() || !row.ys[i]?.trim()) return;
    const x = Number(xs),
      y = Number(row.ys[i]);
    if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y]);
  });
  let reg: { m: number; b: number; r2: number } | undefined;
  if (row.regression && points.length >= 2) {
    const n = points.length;
    const mx = points.reduce((s, p) => s + p[0], 0) / n;
    const my = points.reduce((s, p) => s + p[1], 0) / n;
    let sxy = 0,
      sxx = 0,
      syy = 0;
    for (const [x, y] of points) {
      sxy += (x - mx) * (y - my);
      sxx += (x - mx) ** 2;
      syy += (y - my) ** 2;
    }
    if (sxx > 0) {
      const m = sxy / sxx,
        b = my - m * mx;
      const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
      reg = { m, b, r2 };
    }
  }
  return { kind: 'table', points, reg };
}

/** Evaluate slider values and constant rows in order. */
export function buildEnv(parsed: Parsed[]): Env {
  const env: Env = {};
  parsed.forEach((p) => {
    if (p.kind === 'slider') env[p.name] = p.value;
  });
  return env;
}

export function missingSliders(parsed: Parsed[], env: Env): string[] {
  const miss = new Set<string>();
  parsed.forEach((p) => {
    if ('deps' in p && p.deps)
      p.deps.forEach((d) => {
        if (!(d in env) && d !== 'x' && d !== 'y') miss.add(d);
      });
  });
  return [...miss];
}

// ———— points of interest ————
export type PoiKind = 'root' | 'yint' | 'max' | 'min' | 'intersection' | 'point';
export type Poi = { x: number; y: number; kind: PoiKind; rows: string[] };

function bisect(h: (x: number) => number, a: number, b: number) {
  let fa = h(a);
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2,
      fm = h(m);
    if (fa * fm <= 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return (a + b) / 2;
}

function zeros(h: (x: number) => number, x0: number, x1: number, N = 600): number[] {
  const out: number[] = [];
  // Coincident curves have infinitely many intersections, no isolated POI.
  if (Array.from({ length: 17 }, (_, i) => h(x0 + ((x1 - x0) * i) / 16)).every((v) => v === 0)) return out;
  const dx = (x1 - x0) / N;
  let px = x0,
    pv = h(x0);
  for (let i = 1; i <= N; i++) {
    const x = x0 + i * dx,
      v = h(x);
    if (Number.isFinite(pv) && Number.isFinite(v)) {
      if (pv === 0) out.push(px);
      else if (pv * v < 0) {
        const r = bisect(h, px, x);
        // reject asymptote sign flips
        if (Math.abs(h(r)) < 1e-6 * (1 + Math.abs(pv) + Math.abs(v))) out.push(r);
      }
    }
    px = x;
    pv = v;
  }
  // tangential zeros (double roots such as x² = 0)
  for (let i = 1; i < N; i++) {
    const a = h(x0 + (i - 1) * dx),
      b = h(x0 + i * dx),
      c = h(x0 + (i + 1) * dx);
    if (
      [a, b, c].every(Number.isFinite) &&
      Math.abs(b) < Math.abs(a) &&
      Math.abs(b) < Math.abs(c) &&
      a * c > 0 &&
      Math.sign(a) === Math.sign(b)
    ) {
      const xm = golden((x) => Math.abs(h(x)), x0 + (i - 1) * dx, x0 + (i + 1) * dx);
      if (Math.abs(h(xm)) < 1e-7) out.push(xm);
    }
  }
  if (h(x1) === 0) out.push(x1);
  return dedupe(out);
}

function golden(f: (x: number) => number, a: number, b: number) {
  const g = (Math.sqrt(5) - 1) / 2;
  let c = b - g * (b - a),
    d = a + g * (b - a);
  for (let i = 0; i < 80; i++) {
    if (f(c) < f(d)) b = d;
    else a = c;
    c = b - g * (b - a);
    d = a + g * (b - a);
  }
  return (a + b) / 2;
}

function dedupe(xs: number[]) {
  const s = xs.sort((a, b) => a - b);
  return s.filter((v, i) => i === 0 || Math.abs(v - s[i - 1]) > 1e-5);
}

function snap(v: number) {
  const r = Math.round(v * 1e6) / 1e6;
  const i = Math.round(r);
  return Math.abs(r - i) < 1e-6 ? i : r;
}

export function findPois(rows: Row[], parsed: Parsed[], env: Env, x0: number, x1: number): Poi[] {
  const pois: Poi[] = [];
  const funcs: { id: string; f: (x: number) => number }[] = [];
  const vls: { id: string; c: number }[] = [];
  rows.forEach((r, i) => {
    const p = parsed[i];
    if (r.hidden) return;
    if (p.kind === 'func' && p.rel === '=') funcs.push({ id: r.id, f: (x) => p.f(x, env) });
    if (p.kind === 'implicit' && p.xOnly) {
      for (const c of zeros((x) => p.F(x, 0, env), x0, x1)) vls.push({ id: r.id, c });
    }
    if (p.kind === 'vline' && p.rel === '=') {
      const c = p.c(env);
      if (Number.isFinite(c)) vls.push({ id: r.id, c });
    }
    if (p.kind === 'point') {
      const x = evaluate(p.px, env),
        y = evaluate(p.py, env);
      if (Number.isFinite(x) && Number.isFinite(y)) pois.push({ x, y, kind: 'point', rows: [r.id] });
    }
  });
  const pad = (x1 - x0) * 0.1;
  const a = x0 - pad,
    b = x1 + pad;
  for (const { id, f } of funcs) {
    const y0 = f(0);
    if (Number.isFinite(y0) && 0 >= a && 0 <= b) pois.push({ x: 0, y: snap(y0), kind: 'yint', rows: [id] });
    for (const r of zeros(f, a, b)) pois.push({ x: snap(r), y: 0, kind: 'root', rows: [id] });
    // extrema via derivative sign change
    const N = 500,
      dx = (b - a) / N;
    for (let i = 1; i < N; i++) {
      const xa = a + (i - 1) * dx,
        xb = a + i * dx,
        xc = a + (i + 1) * dx;
      const fa = f(xa),
        fb = f(xb),
        fc = f(xc);
      if (![fa, fb, fc].every(Number.isFinite)) continue;
      if (fb > fa && fb >= fc) {
        const xm = golden((x) => -f(x), xa, xc);
        pois.push({ x: snap(xm), y: snap(f(xm)), kind: 'max', rows: [id] });
      }
      if (fb < fa && fb <= fc) {
        const xm = golden((x) => f(x), xa, xc);
        pois.push({ x: snap(xm), y: snap(f(xm)), kind: 'min', rows: [id] });
      }
    }
  }
  for (let i = 0; i < funcs.length; i++)
    for (let j = i + 1; j < funcs.length; j++) {
      const h = (x: number) => funcs[i].f(x) - funcs[j].f(x);
      for (const r of zeros(h, a, b))
        pois.push({
          x: snap(r),
          y: snap(funcs[i].f(r)),
          kind: 'intersection',
          rows: [funcs[i].id, funcs[j].id],
        });
    }
  for (const v of vls) {
    for (const fn of funcs) {
      const y = fn.f(v.c);
      if (Number.isFinite(y))
        pois.push({ x: snap(v.c), y: snap(y), kind: 'intersection', rows: [v.id, fn.id] });
    }
    pois.push({ x: snap(v.c), y: 0, kind: 'root', rows: [v.id] });
  }
  return pois.filter(
    (p, i) =>
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      !pois
        .slice(0, i)
        .some(
          (q) =>
            q.kind === p.kind && q.rows.join() === p.rows.join() && Math.hypot(q.x - p.x, q.y - p.y) < 1e-5,
        ),
  );
}

export const POI_LABEL_KEY: Record<PoiKind, string> = {
  root: 'ui.x_intercept_root',
  yint: 'ui.y_intercept',
  max: 'ui.maximum',
  min: 'ui.minimum',
  intersection: 'ui.intersection',
  point: 'ui.point',
};

export const fmtPoint = (x: number, y: number) => `(${fmt(x)}, ${fmt(y)})`;

// ———— equivalence for lesson validation ————
const SAMPLE_X = [-7.31, -3.7, -1.2, -0.13, 0, 0.5, 1.41, 2.3, 4.1, 8.71];

/** Does any visible row graph the same relation as `target` (e.g. "y = 2x + 1")? */
export function hasEquivalent(rows: Row[], parsed: Parsed[], env: Env, target: string): boolean {
  const t = parseRow({ id: 't', kind: 'expr', text: target, color: '' });
  return parsed.some((p, i) => !rows[i].hidden && equivalent(p, t, env));
}

export function equivalent(a: Parsed | string, b: Parsed | string, env: Env = {}): boolean {
  const p = typeof a === 'string' ? parseRow({ id: 'a', kind: 'expr', text: a, color: '' }) : a;
  const t = typeof b === 'string' ? parseRow({ id: 'b', kind: 'expr', text: b, color: '' }) : b;
  if (p.kind === 'func' && t.kind === 'func') {
    if (p.rel !== t.rel) return false;
    return SAMPLE_X.every((x) => {
      const a = p.f(x, env),
        b = t.f(x, env);
      return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6 * (1 + Math.abs(b));
    });
  }
  if (p.kind === 'vline' && t.kind === 'vline')
    return Math.abs(p.c(env) - t.c(env)) < 1e-6 && p.rel === t.rel;
  return false;
}
