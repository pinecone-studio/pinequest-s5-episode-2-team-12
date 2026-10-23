import { expect, test } from 'bun:test';
import { HACKS, LESSONS } from './content';
import { evaluate, parseExpr } from './lib/expr';
import { buildEnv, findPois, type Poi, parseRow, type Row } from './lib/graph';
import { validateStep } from './lib/step-validator';
import { toGraphInit } from './lib/table-init';

for (const lesson of LESSONS)
  test(`${lesson.id}: every selection exists and every accepted answer is mathematically correct`, () => {
    const rows: Row[] = lesson.initial.map((raw, i) =>
      typeof raw === 'string'
        ? { id: String(i), kind: 'expr', text: raw, color: '' }
        : {
            id: String(i),
            kind: 'table',
            xs: raw.table.map((p) => String(p[0])),
            ys: raw.table.map((p) => String(p[1])),
            color: '',
            regression: raw.regression,
          },
    );
    let selected: Poi | undefined;
    for (const step of lesson.steps) {
      if (step.type === 'enter')
        rows.push({ id: String(rows.length), kind: 'expr', text: step.target, color: '' });
      if (step.type === 'slider')
        rows.push({ id: String(rows.length), kind: 'expr', text: `${step.name}=${step.value}`, color: '' });
      if (step.type === 'regression') for (const row of rows) if (row.kind === 'table') row.regression = true;
      const parsed = rows.map(parseRow),
        env = buildEnv(parsed);
      for (const p of parsed) expect(p.kind).not.toBe('error');
      if (step.type === 'select') {
        const ps = findPois(rows, parsed, env, -20, 20);
        selected = ps.find(
          (p) => p.kind === step.kind && !!step.at && Math.hypot(p.x - step.at[0], p.y - step.at[1]) < 1e-4,
        );
        expect(selected).toBeDefined();
        if (selected) expect(validateStep(step, { type: 'poi', poi: selected })).toBe(true);
      }
      if (step.type === 'answer') {
        let expected: number | [number, number];
        if (lesson.id === 'd3') {
          expect(selected).toBeDefined();
          expected = [selected!.x, selected!.y];
        } else if (lesson.id === 'd2') expected = selected!.y;
        else if (lesson.id === 'd4' || lesson.id === 'd9') expected = selected!.x;
        else if (lesson.id === 'd7') expected = selected!.x + selected!.y;
        else if (lesson.id === 'd5') expected = evaluate(parseExpr('(7-1)/2'), {});
        else if (lesson.id === 'd6') {
          const table = parsed.find((p) => p.kind === 'table');
          expect(table?.kind).toBe('table');
          expected = table?.kind === 'table' && table.reg ? table.reg.m * 10 + table.reg.b : NaN;
        } else throw new Error(`Missing independent math check for ${lesson.id}`);
        for (const answer of step.accept) {
          const numbers = answer
            .replace(/[xyab]=/g, '')
            .replace(/[()\s]/g, '')
            .split(',')
            .map(Number);
          if (Array.isArray(expected)) expect(numbers).toEqual(expected);
          else {
            if (numbers.length === 2 && lesson.id === 'd2') expect(numbers.shift()).toBe(0);
            expect(numbers).toHaveLength(1);
            expect(numbers[0]).toBeCloseTo(expected, 8);
          }
        }
      }
    }
  });
test('all 9 step types and five valid hacks are present', () => {
  expect(new Set(LESSONS.flatMap((l) => l.steps.map((s) => s.type))).size).toBe(9);
  expect(HACKS).toHaveLength(5);
  for (const hack of HACKS)
    for (const raw of toGraphInit(hack.rows)) {
      const row: Row =
        typeof raw === 'string'
          ? { id: 'h', kind: 'expr', text: raw, color: '' }
          : {
              id: 'h',
              kind: 'table',
              color: '',
              xs: raw.table.map((p) => String(p[0])),
              ys: raw.table.map((p) => String(p[1])),
              regression: raw.regression,
            };
      expect(parseRow(row).kind).not.toBe('error');
    }
});
