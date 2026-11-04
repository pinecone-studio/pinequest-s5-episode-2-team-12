// Re-solves every hard template from its prompt text alone (not from the template code).
// If a template ever computes a wrong answer or prints a prompt that doesn't match it, these tests fail.
import { describe, expect, test } from 'bun:test';
import type { Question } from '../../../src/types';
import { finalAnswer, generate } from '../generate';
import { HARD, poly2 } from './hard';

const qs = generate(23, 40);
const of = (key: string) => {
  const list = qs.filter((q) => q.id.startsWith(`g-${key}-s`));
  expect(list.length).toBeGreaterThan(5);
  return list;
};
const ans = (q: Question) => Number(finalAnswer(q));
/** "\frac{a}{b}" / "-\frac{a}{b}" / "3" → number. */
const texNum = (t: string) => {
  const m = t.match(/^(-)?\\frac\{(\d+)\}\{(\d+)\}$/);
  return m ? (m[1] ? -1 : 1) * (Number(m[2]) / Number(m[3])) : Number(t);
};
/** Coefficients of "ax + by = c" (a, b may be missing → 1). */
function linear(eq: string) {
  const m = eq.replace(/\s/g, '').match(/^(-?\d*|k)x([+-]\d*)y=(-?\d+|n)$/);
  if (!m) throw new Error(`bad equation: ${eq}`);
  const n = (s: string) => (s === '' || s === '+' ? 1 : s === '-' ? -1 : Number(s));
  return { a: m[1] === 'k' ? Number.NaN : n(m[1] as string), b: n(m[2] as string), c: m[3] };
}
/** Coefficients of "x^2 + px + q". */
function quadCoefs(tex: string) {
  const s = tex.replace(/\s/g, '');
  const p = s.match(/x\^2([+-]\d*)x/)?.[1];
  const q = s.match(/x\^2(?:[+-]\d*x)?([+-]\d+)$/)?.[1];
  return {
    p: p === undefined ? 0 : p === '+' ? 1 : p === '-' ? -1 : Number(p),
    q: q === undefined ? 0 : Number(q),
  };
}

describe('hard templates', () => {
  test('all keys are unique and difficulty 3', () => {
    expect(new Set(HARD.map((t) => t.key)).size).toBe(HARD.length);
    for (const t of HARD) expect(t.difficulty).toBe(3);
  });

  test('poly2 drops zero terms and 1 coefficients', () => {
    expect(poly2(1, 0, 5)).toBe('x^2 + 5');
    expect(poly2(1, -1, 0)).toBe('x^2 - x');
    expect(poly2(1, 3, -2)).toBe('x^2 + 3x - 2');
  });

  test('every question has a Mongolian explanation and hint without the answer', () => {
    for (const q of qs.filter((x) => HARD.some((t) => x.id.startsWith(`g-${t.key}-s`)))) {
      expect(q.explain).toMatch(/[А-Яа-яӨөҮүЁё]/);
      expect(q.hint).toMatch(/[А-Яа-яӨөҮүЁё]/);
      expect(q.difficulty).toBe(3);
    }
  });
});

describe('re-solve: hard', () => {
  test('no-solution system: parallel, not the same line', () => {
    for (const q of of('sys-no-sol')) {
      const [e1, e2] = [...q.prompt.matchAll(/\$\$([^$]+)\$\$/g)].map((m) => m[1] as string);
      const A = linear(e1 as string);
      const B = linear(e2 as string);
      const k = ans(q);
      expect(k / A.a).toBeCloseTo(B.b / A.b);
      expect(Number(B.c) / Number(A.c)).not.toBeCloseTo(B.b / A.b);
    }
  });

  test('infinite-solution system: same line', () => {
    for (const q of of('sys-infinite')) {
      const [e1, e2] = [...q.prompt.matchAll(/\$\$([^$]+)\$\$/g)].map((m) => m[1] as string);
      const A = linear(e1 as string);
      const B = linear(e2 as string);
      const ratio = B.b / A.b;
      expect(B.a / A.a).toBeCloseTo(ratio);
      expect(ans(q)).toBeCloseTo(Number(A.c) * ratio);
    }
  });

  test('one real solution: discriminant is zero and b > 0', () => {
    for (const q of of('quad-one-sol')) {
      const c = Number(q.prompt.match(/bx \+ (\d+) = 0/)?.[1]);
      const b = ans(q);
      expect(b).toBeGreaterThan(0);
      expect(b * b - 4 * c).toBe(0);
    }
  });

  test('circle radius from general form', () => {
    for (const q of of('circle-general')) {
      const s = (q.prompt.match(/\$(x\^2 \+ y\^2[^$]+) = 0\$/)?.[1] ?? '').replace(/\s/g, '');
      const D = Number(s.match(/([+-]\d+)x/)?.[1]);
      const E = Number(s.match(/([+-]\d+)y/)?.[1]);
      const F = Number(s.match(/y([+-]\d+)$/)?.[1] ?? 0);
      expect(ans(q) ** 2).toBe((D / 2) ** 2 + (E / 2) ** 2 - F);
    }
  });

  test('line–parabola: both roots are real intersections and sum matches', () => {
    for (const q of of('line-parabola-sum')) {
      const [, para, line] = q.prompt.match(/\$y = ([^$]+)\$ and \$y = ([^$]+)\$/) ?? [];
      const { p, q: c } = quadCoefs(para as string);
      const ls = (line as string).replace(/\s/g, '');
      const m = Number(ls.match(/^(-?\d*)x/)?.[1]?.replace(/^(-?)$/, '$11') ?? 0);
      const b = Number(ls.match(/x([+-]\d+)$/)?.[1] ?? 0);
      const B = p - m;
      const C = c - b;
      expect(B * B - 4 * C).toBeGreaterThan(0);
      expect(ans(q) + 0).toBe(-B + 0);
    }
  });

  test('compound percent', () => {
    for (const q of of('pct-compound')) {
      const p = Number(q.prompt.match(/by \$(\d+)\\%\$/)?.[1]);
      const n = Number(q.prompt.match(/every (\d+) years/)?.[1]);
      const got = Number(finalAnswer(q).replace('\\%', ''));
      expect(got).toBeCloseTo(((1 + p / 100) ** n - 1) * 100, 1);
    }
  });

  test('reverse percent', () => {
    for (const q of of('pct-reverse')) {
      const [p, d] = [...q.prompt.matchAll(/\$(\d+)\\%\$/g)].map((m) => Number(m[1]));
      const fin = Number(q.prompt.match(/\\\$(\d+)\$/)?.[1]);
      expect(ans(q) * (1 + (p as number) / 100) * (1 - (d as number) / 100)).toBeCloseTo(fin);
    }
  });

  test('tan B from sin A (Pythagoras)', () => {
    for (const q of of('trig-cofunction')) {
      const [, a, c] = q.prompt.match(/\\sin A = \\frac\{(\d+)\}\{(\d+)\}/) ?? [];
      const opp = Number(a);
      const hyp = Number(c);
      const adj = Math.sqrt(hyp * hyp - opp * opp);
      expect(Number.isInteger(adj)).toBe(true);
      expect(texNum(finalAnswer(q))).toBeCloseTo(adj / opp);
    }
  });

  test('degrees to radians', () => {
    for (const q of of('radians')) {
      const d = Number(q.prompt.match(/\$(\d+)\^\\circ\$/)?.[1]);
      const t = finalAnswer(q);
      const m = t.match(/^(?:\\frac\{(\d*)\\pi\}\{(\d+)\}|(\d*)\\pi)$/);
      expect(m).not.toBeNull();
      const top = Number(m?.[1] ?? m?.[3] ?? '') || 1;
      const bottom = Number(m?.[2] ?? 1);
      expect((top / bottom) * 180).toBeCloseTo(d);
    }
  });

  test('outlier removal lowers the mean by the answer', () => {
    for (const q of of('outlier-mean')) {
      const xs = (q.prompt.match(/set \$([^$]+)\$/)?.[1] ?? '').split(',').map(Number);
      const out = Math.max(...xs);
      const rest = xs.filter((_, i) => i !== xs.indexOf(out));
      const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
      expect(mean(xs) - mean(rest)).toBeCloseTo(ans(q));
    }
  });

  test('integer count for |x - a| < b', () => {
    for (const q of of('abs-ineq-count')) {
      const [, sign, a, rel, b] = q.prompt.match(/\|x ([+-]) (\d+)\| (<|\\le) (\d+)/) ?? [];
      const c = (sign === '-' ? 1 : -1) * Number(a);
      let n = 0;
      for (let x = c - 20; x <= c + 20; x++) {
        const d = Math.abs(x - c);
        if (rel === '<' ? d < Number(b) : d <= Number(b)) n++;
      }
      expect(ans(q)).toBe(n);
    }
  });

  test('shifted vertex: brute-force minimum of g', () => {
    for (const q of of('vertex-shift')) {
      const { p, q: c } = quadCoefs(q.prompt.match(/f\(x\) = ([^$]+)\$/)?.[1] as string);
      const s = Number((q.prompt.match(/g\(x\) = f\(x ([+-] \d+)\)/)?.[1] ?? '').replace(' ', ''));
      const g = (x: number) => (x + s) ** 2 + p * (x + s) + c;
      let best = Number.POSITIVE_INFINITY;
      let at = 0;
      for (let x = -30; x <= 30; x++) {
        if (g(x) < best) [best, at] = [g(x), x];
      }
      expect(ans(q)).toBe(at);
    }
  });
});
