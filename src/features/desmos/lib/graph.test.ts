import { expect, test } from 'bun:test';
import { buildEnv, equivalent, findPois, missingSliders, type Poi, parseRow, type Row } from './graph';

const make = (texts: string[]): Row[] =>
  texts.map((text, i) => ({ id: String(i), kind: 'expr', text, color: '' }));
function pois(texts: string[], min = -10, max = 10) {
  const rows = make(texts);
  const parsed = rows.map(parseRow);
  return findPois(rows, parsed, buildEnv(parsed), min, max);
}
const has = (ps: Poi[], kind: string, x: number, y: number) =>
  ps.some((p) => p.kind === kind && Math.hypot(p.x - x, p.y - y) < 1e-5);
test('intersection is snapped to (2,5)', () =>
  expect(has(pois(['y=2x+1', 'y=-x+7']), 'intersection', 2, 5)).toBe(true));
test('quadratic roots and vertex', () => {
  const ps = pois(['y=x^2-x-6']);
  expect(has(ps, 'root', -2, 0)).toBe(true);
  expect(has(ps, 'root', 3, 0)).toBe(true);
  expect(has(ps, 'min', 0.5, -6.25)).toBe(true);
});
test('double roots in expression and equation forms', () => {
  expect(has(pois(['y=x^2']), 'root', 0, 0)).toBe(true);
  expect(has(pois(['x²=0']), 'root', 0, 0)).toBe(true);
  expect(has(pois(['y=(x-0.123)^2'], -3, 2), 'root', 0.123, 0)).toBe(true);
});
test('asymptotes and coincident curves produce no false isolated intersections', () => {
  expect(pois(['y=1/x']).filter((p) => p.kind === 'root')).toHaveLength(0);
  expect(pois(['y=x', 'y=x']).filter((p) => p.kind === 'intersection')).toHaveLength(0);
});
test('equivalence compares equations and relation direction', () => {
  expect(equivalent('y=1+2x', 'y=2x+1')).toBe(true);
  expect(equivalent('3x+2y=16', 'y=8-1.5x')).toBe(true);
  expect(equivalent('y<2x+1', 'y>2x+1')).toBe(false);
  expect(equivalent('y=x^2', 'y=x')).toBe(false);
});
test('regression has m=2 b=1 R²=1; blank/malformed cells are not zero', () => {
  const p = parseRow({
    id: 't',
    kind: 'table',
    color: '',
    xs: ['1', '2', '3', '4', '', '2abc'],
    ys: ['3', '5', '7', '9', '', '5'],
    regression: true,
  });
  expect(p.kind).toBe('table');
  if (p.kind === 'table') {
    expect(p.points).toHaveLength(4);
    expect(p.reg).toEqual({ m: 2, b: 1, r2: 1 });
  }
});
test('vertical-data regression is undefined', () => {
  const p = parseRow({ id: 't', kind: 'table', color: '', xs: ['1', '1'], ys: ['2', '3'], regression: true });
  if (p.kind === 'table') expect(p.reg).toBeUndefined();
});
test('sliders change function evaluation', () => {
  const rows = make(['y=ax+1', 'a=1']);
  const parsed = rows.map(parseRow);
  expect(missingSliders(parsed, buildEnv(parsed))).toEqual([]);
  const p = parsed[0];
  if (p.kind === 'func') {
    expect(p.f(2, buildEnv(parsed))).toBe(3);
    rows[1] = { ...rows[1], kind: 'expr', text: 'a=3' };
    expect(p.f(2, buildEnv(rows.map(parseRow)))).toBe(7);
  }
});
test('hidden rows do not contribute POIs', () => {
  const rows = make(['y=x']);
  rows[0].hidden = true;
  expect(findPois(rows, rows.map(parseRow), {}, -10, 10)).toEqual([]);
});
