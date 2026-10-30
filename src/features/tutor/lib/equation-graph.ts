// Photomath-style graph lesson for a typed equation in x, built without the model:
// both sides become functions, the graphs are drawn, and their crossing points are the solutions.
// "5(x - 4) + 7 = 3(x + 2) + 5" → y = 5(x−4)+7 (blue), y = 3(x+2)+5 (red), crossing (13, 52) → x = 13.
// Pure (no DOM), so the server route and the chat can both use it. Anything it can't read → null.
import type { DesmosAiLesson, DesmosItem, DesmosStep } from './desmos-lessons';

type Node =
  | { t: 'num'; v: number }
  | { t: 'x' }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { t: 'sqrt'; a: Node };

const MATH_RUN = /[0-9xX+\-*/^().,\s=√²³·×÷−]+|sqrt/g;

/** The equation inside a typed message ("Solve x: 5(x − 4) + 7 = 3(x + 2) + 5" → "5(x-4)+7=3(x+2)+5"), or null. */
export function extractEquation(text: string): string | null {
  const runs = text.replace(/sqrt/gi, '√').match(MATH_RUN) ?? [];
  const best = runs
    .map((r) =>
      r
        .replace(/[−]/g, '-')
        .replace(/[×·]/g, '*')
        .replace(/÷/g, '/')
        .replace(/²/g, '^2')
        .replace(/³/g, '^3')
        .replace(/X/g, 'x')
        .replace(/,/g, '.')
        .replace(/\s+/g, '')
        .replace(/^[^0-9x(√-]+|[^0-9x)]+$/g, ''),
    )
    .filter((r) => /^[^=]+=[^=]+$/.test(r) && r.includes('x'))
    .sort((a, b) => b.length - a.length)[0];
  if (!best) return null;
  const [l, r] = best.split('=');
  return l && r && parse(l) && parse(r) ? best : null;
}

/** Recursive-descent parser: + − × ÷ ^, brackets, √, unary minus and implicit multiplication (5(x−4), 3x). */
export function parse(src: string): Node | null {
  const found = src.match(/\d+(?:\.\d+)?|[x+\-*/^()√]/g);
  if (!found || found.join('') !== src) return null;
  const toks: string[] = found;
  let i = 0;
  const peek = () => toks[i];
  const startsFactor = (s?: string) => s !== undefined && /^(\d|x|\(|√)/.test(s);

  function expr(): Node {
    let a = term();
    while (peek() === '+' || peek() === '-') {
      const op = toks[i++] as '+' | '-';
      a = { t: 'bin', op, a, b: term() };
    }
    return a;
  }
  function term(): Node {
    let a = unary();
    for (;;) {
      if (peek() === '*' || peek() === '/') {
        const op = toks[i++] as '*' | '/';
        a = { t: 'bin', op, a, b: unary() };
      } else if (startsFactor(peek())) {
        a = { t: 'bin', op: '*', a, b: power() };
      } else return a;
    }
  }
  function unary(): Node {
    if (peek() === '-') {
      i++;
      return { t: 'neg', a: unary() };
    }
    if (peek() === '+') i++;
    return power();
  }
  function power(): Node {
    const base = atom();
    if (peek() === '^') {
      i++;
      return { t: 'bin', op: '^', a: base, b: unary() };
    }
    return base;
  }
  function atom(): Node {
    const s = toks[i++];
    if (s === undefined) throw new Error('end');
    if (s === 'x') return { t: 'x' };
    if (s === '√') return { t: 'sqrt', a: power() };
    if (s === '(') {
      const e = expr();
      if (toks[i++] !== ')') throw new Error(')');
      return e;
    }
    if (/^\d/.test(s)) return { t: 'num', v: Number(s) };
    throw new Error(s);
  }
  try {
    const n = expr();
    return i === toks.length ? n : null;
  } catch {
    return null;
  }
}

export function evaluate(n: Node, x: number): number {
  switch (n.t) {
    case 'num':
      return n.v;
    case 'x':
      return x;
    case 'neg':
      return -evaluate(n.a, x);
    case 'sqrt':
      return Math.sqrt(evaluate(n.a, x));
    case 'bin': {
      const a = evaluate(n.a, x);
      const b = evaluate(n.b, x);
      if (n.op === '+') return a + b;
      if (n.op === '-') return a - b;
      if (n.op === '*') return a * b;
      if (n.op === '/') return a / b;
      return a ** b;
    }
  }
}

const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 } as const;

/** Desmos LaTeX for a parsed side (fractions as \frac, products written the way the student did). */
export function toLatex(n: Node, parent = 0): string {
  switch (n.t) {
    case 'num':
      return String(n.v);
    case 'x':
      return 'x';
    case 'neg':
      return wrap(`-${toLatex(n.a, 2)}`, parent > 1);
    case 'sqrt':
      return `\\sqrt{${toLatex(n.a)}}`;
    case 'bin': {
      if (n.op === '/') return `\\frac{${toLatex(n.a)}}{${toLatex(n.b)}}`;
      if (n.op === '^') return `${toLatex(n.a, 4)}^{${toLatex(n.b)}}`;
      const p = PREC[n.op];
      const left = toLatex(n.a, p);
      const right = toLatex(n.b, n.op === '-' ? p + 1 : p);
      const s =
        n.op === '*'
          ? /^[\d.]/.test(right)
            ? `${left}\\cdot ${right}`
            : `${left}${right}`
          : `${left}${n.op}${right}`;
      return wrap(s, p < parent);
    }
  }
}

const wrap = (s: string, yes: boolean) => (yes ? `\\left(${s}\\right)` : s);

/** Readable plain text of a LaTeX side, for the step text. */
const plain = (latex: string) =>
  latex
    .replace(/\\left\(/g, '(')
    .replace(/\\right\)/g, ')')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, (_, a: string, b: string) => `${group(a)}/${group(b)}`)
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
    .replace(/\\cdot /g, '·')
    .replace(/\^\{([^{}]*)\}/g, '^$1');

const group = (s: string) => (/^[\w.]+$/.test(s) ? s : `(${s})`);

/** 13 → "13", 2.5 → "5/2", 1.41421356 → "1.4142". */
export function nice(v: number): string {
  const r = Math.round(v);
  if (Math.abs(v - r) < 1e-9) return String(r === 0 ? 0 : r);
  for (let d = 2; d <= 12; d++) {
    const n = Math.round(v * d);
    if (Math.abs(v - n / d) < 1e-9) return `${n}/${d}`;
  }
  return String(Number(v.toFixed(4)));
}

export type Solution = { kind: 'roots'; roots: number[] } | { kind: 'none' } | { kind: 'all' };

/** Real solutions of left = right by scanning for sign changes and touching points, then bisection. */
export function solve(left: Node, right: Node): Solution {
  const f = (x: number) => evaluate(left, x) - evaluate(right, x);
  const probes = [-7.3, -1.1, 0.4, 2.9, 11.7];
  if (probes.every((x) => Math.abs(f(x)) < 1e-9)) return { kind: 'all' };

  const roots: number[] = [];
  const add = (x: number) => {
    if (Math.abs(f(x)) > 1e-6 * Math.max(1, Math.abs(evaluate(left, x)))) return; // a pole, not a root
    if (!roots.some((r) => Math.abs(r - x) < 1e-6)) roots.push(x);
  };
  const scan = (from: number, to: number, steps: number) => {
    let px = from;
    let pf = f(px);
    for (let k = 1; k <= steps; k++) {
      const x = from + ((to - from) * k) / steps;
      const fx = f(x);
      if (Number.isFinite(fx) && Math.abs(fx) < 1e-9) add(x);
      else if (Number.isFinite(pf) && Number.isFinite(fx) && pf * fx < 0) {
        let a = px;
        let b = x;
        for (let j = 0; j < 80; j++) {
          const m = (a + b) / 2;
          if (f(a) * f(m) <= 0) b = m;
          else a = m;
        }
        add((a + b) / 2);
      }
      px = x;
      pf = fx;
    }
  };
  scan(-100, 100, 20000);
  if (roots.length === 0) scan(-10000, 10000, 20000);
  if (roots.length === 0) return { kind: 'none' };
  // snap 12.999999 → 13 when the snapped value is a root too
  const snapped = roots.map((r) => {
    const s = Number(nice(r).includes('/') ? fracValue(nice(r)) : nice(r));
    return Math.abs(f(s)) < 1e-9 ? s : r;
  });
  return { kind: 'roots', roots: [...new Set(snapped)].sort((a, b) => a - b).slice(0, 4) };
}

const fracValue = (s: string) => {
  const [n, d] = s.split('/').map(Number);
  return n / d;
};

/** The whole graph lesson for a typed message, or null when it holds no equation this solver can read. */
export function equationLesson(text: string): DesmosAiLesson | null {
  const eq = extractEquation(text);
  if (!eq) return null;
  const [l, r] = eq.split('=');
  const left = parse(l);
  const right = parse(r);
  if (!left || !right) return null;
  const L = toLatex(left);
  const R = toLatex(right);
  const sol = solve(left, right);
  const shown = `${plain(L)} = ${plain(R)}`;

  const steps: DesmosStep[] = [
    {
      text: `Тэгшитгэлийн зүүн талыг функц болгож зур: y = ${plain(L)} (цэнхэр).`,
      desmos: [{ latex: `y=${L}`, color: 'blue', label: 'зүүн тал', showLabel: false }],
    },
    {
      text: `Баруун талыг мөн зур: y = ${plain(R)} (улаан).`,
      desmos: [{ latex: `y=${R}`, color: 'red' }],
    },
  ];

  let answer: string;
  let check: string;
  if (sol.kind === 'all') {
    answer = 'Бүх x';
    check = 'Хоёр тал ижил функц';
    steps.push({
      text: 'Хоёр график яг давхцаж байна → x-ийн дурын утга шийд болно (төгсгөлгүй олон шийд).',
      desmos: [],
    });
  } else if (sol.kind === 'none') {
    answer = 'Шийдгүй';
    check = 'Графикууд огтлолцохгүй';
    steps.push({
      text: 'Хоёр график хаана ч огтлолцохгүй байна → тэгшитгэл шийдгүй.',
      desmos: [],
    });
  } else {
    const pts = sol.roots.map((x) => ({ x, y: evaluate(left, x) }));
    const ptText = pts.map((p) => `(${nice(p.x)}, ${nice(p.y)})`).join(', ');
    const items: DesmosItem[] = pts.map((p) => ({
      latex: `(${p.x},${p.y})`,
      color: 'green',
      label: `(${nice(p.x)}, ${nice(p.y)})`,
      showLabel: true,
    }));
    steps.push({
      text: `Хоёр график огтлолцох цэг дээр хоёр тал тэнцүү. Огтлолцлын цэг: ${ptText}.`,
      desmos: items,
      bounds: boundsFor(pts),
    });
    answer = sol.roots.map((x) => `x = ${nice(x)}`).join(', ');
    const p = pts[0];
    check = `x = ${nice(p.x)}: зүүн тал = ${nice(p.y)}, баруун тал = ${nice(evaluate(right, p.x))} ✓`;
    steps.push({
      text: `Огтлолцлын цэгийн x-координат нь шийд: ${answer}. Шалгах: ${check}`,
      desmos: sol.roots.map((x) => ({ latex: `x=${x}`, color: 'green', lineStyle: 'DASHED' }) as DesmosItem),
    });
  }
  if (sol.kind !== 'roots') steps[0].bounds = boundsFor([{ x: 0, y: evaluate(left, 0) }]);
  else steps[0].bounds = steps[2].bounds;

  return { id: 'solver', title: 'Графикаар бодох', question: shown, answer, check, match: [], steps };
}

function boundsFor(pts: { x: number; y: number }[]) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y).filter(Number.isFinite);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = ys.length ? [Math.min(...ys), Math.max(...ys)] : [0, 0];
  const px = Math.max(5, (x1 - x0) * 0.6);
  const py = Math.max(5, (y1 - y0) * 0.6, Math.abs(y1) * 0.5);
  return { left: x0 - px, right: x1 + px, bottom: y0 - py, top: y1 + py };
}

/** a·x + b when a side is linear (checked at three points), else null. */
function linear(n: Node): { a: number; b: number } | null {
  const b = evaluate(n, 0);
  const a = evaluate(n, 1) - b;
  const ok = [-3.7, 2.2, 9.1].every((x) => Math.abs(evaluate(n, x) - (a * x + b)) < 1e-9);
  return ok && Number.isFinite(a) && Number.isFinite(b) ? { a, b } : null;
}

/** "5x − 13", "−x + 2", "24" in KaTeX. */
function axb(a: number, b: number): string {
  const ax = a === 0 ? '' : a === 1 ? 'x' : a === -1 ? '-x' : `${tex(a)}x`;
  if (!ax) return tex(b);
  if (b === 0) return ax;
  return `${ax} ${b < 0 ? '-' : '+'} ${tex(Math.abs(b))}`;
}

/** 5 → "5", −1/2 → "-\frac{1}{2}". */
function tex(v: number): string {
  const s = nice(v);
  if (!s.includes('/')) return s;
  const [n, d] = s.split('/');
  return n.startsWith('-') ? `-\\frac{${n.slice(1)}}{${d}}` : `\\frac{${n}}{${d}}`;
}

export type EquationReply = { text: string; roots: number[] | null };

/**
 * The chat answer for a typed equation, worked out by code so it always agrees with the graph next to it.
 * Linear equations get the algebra (expand, collect, divide); every kind ends with the check and the graph.
 */
export function equationReply(message: string): EquationReply | null {
  const eq = extractEquation(message);
  if (!eq) return null;
  const [l, r] = eq.split('=');
  const left = parse(l);
  const right = parse(r);
  if (!left || !right) return null;
  const L = toLatex(left);
  const R = toLatex(right);
  const sol = solve(left, right);
  const lines = [`**Тэгшитгэл:** $${L} = ${R}$`];

  if (sol.kind === 'all') {
    lines.push(
      'Хоёр талыг хялбарчлахад яг ижил болно — графикууд давхцаж байна.',
      '**Хариу:** x-ийн дурын утга шийд.',
    );
    return { text: lines.join('\n\n'), roots: null };
  }
  if (sol.kind === 'none') {
    lines.push('Хоёр талын график хаана ч огтлолцохгүй байна.', '**Хариу:** шийдгүй.');
    return { text: lines.join('\n\n'), roots: null };
  }

  const ll = linear(left);
  const rl = linear(right);
  if (ll && rl && ll.a !== rl.a) {
    const a = ll.a - rl.a;
    const b = rl.b - ll.b;
    const steps = [];
    const same = (a: string, b: string) => a.replace(/\s/g, '') === b.replace(/\s/g, '');
    if (!same(axb(ll.a, ll.b), L) || !same(axb(rl.a, rl.b), R)) {
      steps.push(`1) Хаалтыг задлаад төстэй гишүүдийг нэгтгэ: $${axb(ll.a, ll.b)} = ${axb(rl.a, rl.b)}$`);
    }
    steps.push(
      `${steps.length + 1}) x-тэй гишүүдийг нэг тал руу, тоог нөгөө тал руу шилжүүл: $${axb(a, 0)} = ${tex(b)}$`,
    );
    if (a !== 1) steps.push(`${steps.length + 1}) Хоёр талыг $${tex(a)}$-д хуваа: $x = ${tex(b / a)}$`);
    lines.push(steps.join('\n'));
  } else {
    lines.push('Хоёр талыг тус тусад нь функц болгож зурвал графикууд огтлолцох цэгүүд нь шийд болно.');
  }

  const x0 = sol.roots[0];
  lines.push(
    `**Шалгах:** $x = ${tex(x0)}$ үед зүүн тал $= ${tex(evaluate(left, x0))}$, баруун тал $= ${tex(evaluate(right, x0))}$ ✓`,
    `**Графикт:** хоёр график ${sol.roots.map((x) => `$(${tex(x)},\\ ${tex(evaluate(left, x))})$`).join(', ')} цэг дээр огтлолцож байна.`,
    `**Хариу:** ${sol.roots.map((x) => `$x = ${tex(x)}$`).join(', ')}`,
  );
  return { text: lines.join('\n\n'), roots: sol.roots };
}

/**
 * True when a model's chat reply states the same solution(s) as the solver: every "x = …" / "Хариу: …" number
 * it gives is a root. A reply that never states a number is not trusted either.
 */
export function replyAgrees(text: string, roots: number[] | null): boolean {
  if (!roots) return false;
  const stated = [
    ...text.replace(/\$/g, '').matchAll(/(?:\bx\s*=|Хариу\s*:)\s*(-?\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?)/gi),
  ].map((m) => {
    const s = m[1].replace(',', '.').replace(/\s/g, '');
    return s.includes('/') ? fracValue(s) : Number(s);
  });
  return stated.length > 0 && stated.every((v) => roots.some((r) => Math.abs(r - v) < 1e-4));
}
