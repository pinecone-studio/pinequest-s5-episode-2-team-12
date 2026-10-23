import { mathMessage } from './math-messages';
// Small math-expression engine for the SuuPrep graphing calculator.
// Parses what students type the way Desmos does: implicit multiplication (2x, 3(x+1), ax),
// ^ powers, sqrt/abs/sin…, π, relations (=, <, >, ≤, ≥) and points (a, b).

export type Node =
  | { t: 'num'; v: number }
  | { t: 'var'; name: string }
  | { t: 'neg'; a: Node }
  | { t: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: Node; b: Node }
  | { t: 'call'; fn: string; a: Node };

export type Env = Record<string, number>;

const FUNCS = ['sqrt', 'abs', 'sin', 'cos', 'tan', 'ln', 'log', 'exp'];

type Tok = { k: 'num'; v: number } | { k: 'id'; v: string } | { k: 'op'; v: string };

export function normalize(src: string) {
  return src
    .replace(/[−–]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/≤|=</g, '<=')
    .replace(/≥|=>/g, '>=')
    .replace(/π/g, 'pi')
    .replace(/√/g, 'sqrt')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/\s+/g, '');
}

function tokenize(s: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const v = Number(s.slice(i, j));
      if (!Number.isFinite(v)) throw new Error(mathMessage('ui.invalid_number'));
      out.push({ k: 'num', v });
      i = j;
    } else if (/[a-zA-Z]/.test(c)) {
      let j = i;
      while (j < s.length && /[a-zA-Z]/.test(s[j])) j++;
      let word = s.slice(i, j);
      // split a run of letters into known function names / pi / single-letter variables
      while (word.length) {
        const f = FUNCS.find((fn) => word.startsWith(fn));
        if (f) {
          out.push({ k: 'id', v: f });
          word = word.slice(f.length);
          continue;
        }
        if (word.startsWith('pi')) {
          out.push({ k: 'id', v: 'pi' });
          word = word.slice(2);
          continue;
        }
        out.push({ k: 'id', v: word[0] });
        word = word.slice(1);
      }
      i = j;
    } else if ('+-*/^(),'.includes(c)) {
      out.push({ k: 'op', v: c });
      i++;
    } else {
      throw new Error(mathMessage('ui.unknown_character_value', { v0: c }));
    }
  }
  return out;
}

class Parser {
  i = 0;
  constructor(public toks: Tok[]) {}
  peek() {
    return this.toks[this.i];
  }
  next() {
    return this.toks[this.i++];
  }
  isOp(v: string) {
    const t = this.peek();
    return !!t && t.k === 'op' && t.v === v;
  }
  expect(v: string) {
    if (!this.isOp(v))
      throw new Error(
        v === ')' ? mathMessage('ui.unclosed_parenthesis') : mathMessage('ui.expected_value', { v0: v }),
      );
    this.i++;
  }
  parse(): Node {
    const n = this.add();
    if (this.i < this.toks.length)
      throw new Error(mathMessage('ui.incomplete_expression_or_extra_characters'));
    return n;
  }
  add(): Node {
    let a = this.mul();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().v as '+' | '-';
      a = { t: 'bin', op, a, b: this.mul() };
    }
    return a;
  }
  startsFactor() {
    const t = this.peek();
    if (!t) return false;
    if (t.k === 'num' || t.k === 'id') return true;
    return t.k === 'op' && t.v === '(';
  }
  mul(): Node {
    let a = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/')) {
        const op = this.next().v as '*' | '/';
        a = { t: 'bin', op, a, b: this.unary() };
      } else if (this.startsFactor()) {
        a = { t: 'bin', op: '*', a, b: this.pow() }; // implicit multiplication
      } else break;
    }
    return a;
  }
  unary(): Node {
    if (this.isOp('-')) {
      this.next();
      return { t: 'neg', a: this.unary() };
    }
    if (this.isOp('+')) {
      this.next();
      return this.unary();
    }
    return this.pow();
  }
  pow(): Node {
    const base = this.atom();
    if (this.isOp('^')) {
      this.next();
      return { t: 'bin', op: '^', a: base, b: this.unary() };
    }
    return base;
  }
  atom(): Node {
    const t = this.next();
    if (!t) throw new Error(mathMessage('ui.incomplete_expression'));
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'id') {
      if (FUNCS.includes(t.v)) {
        if (this.isOp('(')) {
          this.next();
          const a = this.add();
          this.expect(')');
          return { t: 'call', fn: t.v, a };
        }
        return { t: 'call', fn: t.v, a: this.pow() };
      }
      if (t.v === 'pi') return { t: 'num', v: Math.PI };
      if (t.v === 'e') return { t: 'num', v: Math.E };
      return { t: 'var', name: t.v };
    }
    if (t.v === '(') {
      const a = this.add();
      this.expect(')');
      return a;
    }
    if (t.v === '|') throw new Error(mathMessage('ui.use_abs'));
    throw new Error(mathMessage('ui.unexpected_value', { v0: t.v }));
  }
}

export function parseExpr(src: string): Node {
  return new Parser(tokenize(normalize(src))).parse();
}

export function evaluate(n: Node, env: Env): number {
  switch (n.t) {
    case 'num':
      return n.v;
    case 'var':
      return n.name in env ? env[n.name] : NaN;
    case 'neg':
      return -evaluate(n.a, env);
    case 'call': {
      const a = evaluate(n.a, env);
      switch (n.fn) {
        case 'sqrt':
          return Math.sqrt(a);
        case 'abs':
          return Math.abs(a);
        case 'sin':
          return Math.sin(a);
        case 'cos':
          return Math.cos(a);
        case 'tan':
          return Math.tan(a);
        case 'ln':
          return Math.log(a);
        case 'log':
          return Math.log10(a);
        case 'exp':
          return Math.exp(a);
      }
      return NaN;
    }
    case 'bin': {
      const a = evaluate(n.a, env),
        b = evaluate(n.b, env);
      switch (n.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return a / b;
        case '^':
          return a ** b;
      }
    }
  }
  return NaN;
}

export function vars(n: Node, acc = new Set<string>()): Set<string> {
  if (n.t === 'var') acc.add(n.name);
  else if (n.t === 'neg' || n.t === 'call') vars(n.a, acc);
  else if (n.t === 'bin') {
    vars(n.a, acc);
    vars(n.b, acc);
  }
  return acc;
}

// ———— TeX output (pretty rendering of a parsed row) ————
const PREC: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
export function toTex(n: Node, parentPrec = 0): string {
  switch (n.t) {
    case 'num': {
      if (Math.abs(n.v - Math.PI) < 1e-12) return '\\pi';
      return String(n.v);
    }
    case 'var':
      return n.name;
    case 'neg': {
      const s = `-${toTex(n.a, 2.5)}`;
      return parentPrec > 1 ? `\\left(${s}\\right)` : s;
    }
    case 'call': {
      if (n.fn === 'sqrt') return `\\sqrt{${toTex(n.a)}}`;
      if (n.fn === 'abs') return `\\left|${toTex(n.a)}\\right|`;
      return `\\operatorname{${n.fn}}\\left(${toTex(n.a)}\\right)`;
    }
    case 'bin': {
      if (n.op === '/') return `\\frac{${toTex(n.a)}}{${toTex(n.b)}}`;
      if (n.op === '^') return `{${toTex(n.a, 4)}}^{${toTex(n.b)}}`;
      const p = PREC[n.op];
      let s: string;
      if (n.op === '*') {
        const implicit =
          n.b.t === 'var' || (n.b.t === 'bin' && n.b.op === '^' && n.b.a.t === 'var') || n.b.t === 'call';
        const left = toTex(n.a, p);
        const right = toTex(n.b, p + 0.5);
        s = implicit && n.a.t !== 'var' ? left + right : implicit ? left + right : `${left}\\cdot ${right}`;
      } else if (n.op === '+' && n.b.t === 'neg') {
        s = `${toTex(n.a, p)}-${toTex(n.b.a, p + 0.5)}`;
      } else {
        s = `${toTex(n.a, p)}${n.op}${toTex(n.b, p + 0.5)}`;
      }
      return p < parentPrec ? `\\left(${s}\\right)` : s;
    }
  }
}

export function fmt(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return '—';
  const r = Math.round(v);
  if (Math.abs(v - r) < 1e-6) return String(r === 0 ? 0 : r);
  return String(+v.toFixed(digits));
}

/** Plain-text math typed by content authors → TeX, e.g. "3x+5<=20" → "3x+5\le 20". */
export function plainToTex(src: string): string {
  const rel = splitRelation(src);
  try {
    if (!rel) return toTex(parseExpr(src));
    return `${toTex(parseExpr(rel.lhs))}${REL_TEX[rel.op]}${toTex(parseExpr(rel.rhs))}`;
  } catch {
    return src;
  }
}

export type RelOp = '=' | '<' | '>' | '<=' | '>=';
export const REL_TEX: Record<RelOp, string> = { '=': '=', '<': '<', '>': '>', '<=': '\\le ', '>=': '\\ge ' };

export function splitRelation(raw: string): { lhs: string; op: RelOp; rhs: string } | null {
  const s = normalize(raw);
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (depth === 0 && (c === '=' || c === '<' || c === '>')) {
      let op: RelOp = c as RelOp;
      let j = i + 1;
      if ((c === '<' || c === '>') && s[i + 1] === '=') {
        op = `${c}=` as RelOp;
        j = i + 2;
      }
      const lhs = s.slice(0, i),
        rhs = s.slice(j);
      if (!lhs || !rhs) throw new Error(mathMessage('ui.both_sides_of_the_relation_need_an_expression'));
      return { lhs, op, rhs };
    }
  }
  return null;
}
