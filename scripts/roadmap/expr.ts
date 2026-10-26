// Tiny safe math evaluator for check-answers (no eval). Trimmed port of prototype/src/lib/expr.ts:
// numbers, x-style single-letter variables, + - * / ^, implicit multiplication, sqrt/abs/sin/cos/tan, pi.
// Also turns simple LaTeX (\frac, \sqrt, \pi, \cdot, ^{…}) into this syntax.

type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; name: string }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'call'; fn: string; a: Node };
type Tok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string };

const FUNCS = ['sqrt', 'abs', 'sin', 'cos', 'tan'];

/** LaTeX → plain expression. Returns null for text that is clearly not a number (words, units…). */
export function texToExpr(tex: string): string | null {
  let s = tex.trim().replace(/^\$+|\$+$/g, '');
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s
      .replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
      .replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)')
      .replace(/\^\{([^{}]*)\}/g, '^($1)');
  }
  s = s
    .replace(/\\left|\\right/g, '')
    .replace(/\\pi/g, 'pi')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\,|\\!|\\ /g, '')
    .replace(/\^\\circ|°/g, '')
    .replace(/,(?=\d{3}\b)/g, '')
    .replace(/[{}]/g, '');
  if (/\\[a-zA-Z]|[a-zA-Z]{3,}/.test(s.replace(/sqrt|pi|abs|sin|cos|tan/g, ''))) return null;
  return s;
}

function tokenize(src: string): Tok[] {
  const s = src.replace(/[−–]/g, '-').replace(/[×·]/g, '*').replace(/\s+/g, '');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      out.push({ k: 'num', v: Number.parseFloat(s.slice(i, j)) });
      i = j;
    } else if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      let word = s.slice(i, j);
      while (word.length) {
        const f = [...FUNCS, 'pi'].find((fn) => word.startsWith(fn));
        if (f) {
          out.push({ k: 'id', v: f });
          word = word.slice(f.length);
        } else {
          out.push({ k: 'id', v: word[0] });
          word = word.slice(1);
        }
      }
      i = j;
    } else if ('+-*/^()'.includes(c)) {
      out.push({ k: 'op', v: c });
      i++;
    } else throw new Error(`unexpected "${c}"`);
  }
  return out;
}

class Parser {
  i = 0;
  constructor(private toks: Tok[]) {}
  private peek() {
    return this.toks[this.i];
  }
  private isOp(v: string) {
    const t = this.peek();
    return !!t && t.k === 'op' && t.v === v;
  }
  parse(): Node {
    const n = this.add();
    if (this.i < this.toks.length) throw new Error('trailing input');
    return n;
  }
  private add(): Node {
    let a = this.mul();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.toks[this.i++] as { v: string }).v;
      a = { t: 'bin', op, a, b: this.mul() };
    }
    return a;
  }
  private startsFactor() {
    const t = this.peek();
    return !!t && (t.k !== 'op' || t.v === '(');
  }
  private mul(): Node {
    let a = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = (this.toks[this.i++] as { v: string }).v;
        a = { t: 'bin', op, a, b: this.unary() };
      } else if (this.startsFactor()) a = { t: 'bin', op: '*', a, b: this.pow() };
      else return a;
    }
  }
  private unary(): Node {
    if (this.isOp('-')) {
      this.i++;
      return { t: 'neg', a: this.unary() };
    }
    if (this.isOp('+')) {
      this.i++;
      return this.unary();
    }
    return this.pow();
  }
  private pow(): Node {
    const base = this.atom();
    if (this.isOp('^')) {
      this.i++;
      return { t: 'bin', op: '^', a: base, b: this.unary() };
    }
    return base;
  }
  private atom(): Node {
    const t = this.toks[this.i++];
    if (!t) throw new Error('unexpected end');
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'id') {
      if (FUNCS.includes(t.v)) {
        if (this.isOp('(')) {
          this.i++;
          const a = this.add();
          if (!this.isOp(')')) throw new Error('missing )');
          this.i++;
          return { t: 'call', fn: t.v, a };
        }
        return { t: 'call', fn: t.v, a: this.pow() };
      }
      if (t.v === 'pi') return { t: 'num', v: Math.PI };
      return { t: 'var', name: t.v };
    }
    if (t.v === '(') {
      const a = this.add();
      if (!this.isOp(')')) throw new Error('missing )');
      this.i++;
      return a;
    }
    throw new Error(`unexpected "${t.v}"`);
  }
}

function ev(n: Node, env: Record<string, number>): number {
  switch (n.t) {
    case 'num':
      return n.v;
    case 'var':
      return n.name in env ? env[n.name] : Number.NaN;
    case 'neg':
      return -ev(n.a, env);
    case 'call': {
      const a = ev(n.a, env);
      return (
        { sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan } as Record<
          string,
          (x: number) => number
        >
      )[n.fn](a);
    }
    case 'bin': {
      const a = ev(n.a, env);
      const b = ev(n.b, env);
      if (n.op === '+') return a + b;
      if (n.op === '-') return a - b;
      if (n.op === '*') return a * b;
      if (n.op === '/') return a / b;
      return a ** b;
    }
  }
}

export function evaluate(src: string, env: Record<string, number> = {}): number {
  return ev(new Parser(tokenize(src)).parse(), env);
}

/** Numeric value of an answer string ("3/4", ".75", "$\\frac{3}{4}$", "2\\sqrt{3}"), or null. */
export function numeric(s: string): number | null {
  const e = texToExpr(s);
  if (e === null || e === '') return null;
  try {
    const v = evaluate(e);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export const close = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
