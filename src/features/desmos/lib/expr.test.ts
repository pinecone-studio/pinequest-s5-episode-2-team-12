import { expect, test } from 'bun:test';
import { evaluate, parseExpr, toTex } from './expr';
import { parseRow, type Row } from './graph';

const row = (text: string): Row => ({ id: 'r', kind: 'expr', text, color: '' });
const cases = [
  ['', 'empty'],
  ['2x', 'func'],
  ['3(x+1)', 'func'],
  ['y=ax+1', 'func'],
  ['x^2', 'func'],
  ['sqrt(x)', 'func'],
  ['π', 'value'],
  ['y≤2x+1', 'func'],
  ['(a,b)', 'point'],
  ['a=3', 'slider'],
  ['x^2+y^2=25', 'implicit'],
] as const;
for (const [source, kind] of cases)
  test(`classifies ${source || 'empty'} as ${kind}`, () => expect(parseRow(row(source)).kind).toBe(kind));
test('linear equation is solved for y', () => {
  const p = parseRow(row('3x+2y=16'));
  expect(p.kind).toBe('func');
  if (p.kind === 'func') expect(p.f(4, {})).toBe(2);
});
test('implicit multiplication and precedence', () => {
  for (const [source, result] of [
    ['2x', 4],
    ['3(x+1)', 9],
    ['ax', 6],
    ['-x^2', -4],
    ['2^3^2', 512],
    ['2^-2', 0.25],
    ['sqrt(9)', 3],
    ['π', Math.PI],
  ] as const)
    expect(evaluate(parseExpr(source), { x: 2, a: 3 })).toBeCloseTo(result, 10);
});
test('invalid input returns Mongolian errors', () => {
  expect(parseRow(row('y=3(x+1'))).toEqual({ kind: 'error', message: 'Хаалт хаагдаагүй байна' });
  for (const text of ['1..2', 'y=', 'y=2$', 'y=)']) expect(parseRow(row(text)).kind).toBe('error');
});
test('TeX preserves parentheses and powers', () => {
  expect(toTex(parseExpr('sqrt(x^2)'))).toContain('\\sqrt');
  expect(toTex(parseExpr('(x+1)^2'))).toContain('\\left(');
  expect(toTex(parseExpr('1/3'))).toBe('\\frac{1}{3}');
  expect(toTex(parseExpr('pi'))).toBe('\\pi');
});
test('polynomials nonlinear in y are never guessed linear', () =>
  expect(parseRow(row('x+y*(y-1)*(y-2)*(y+5)=3')).kind).toBe('implicit'));
