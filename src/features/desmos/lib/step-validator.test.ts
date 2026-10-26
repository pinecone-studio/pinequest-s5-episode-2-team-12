import { expect, test } from 'bun:test';
import type { DesmosStep } from '@/types';
import type { GraphState } from '../components/graph-calc';
import { buildEnv, parseRow, type Row } from './graph';
import { type LessonEvent, validateStep } from './step-validator';

const state = (...texts: string[]): GraphState => {
  const rows: Row[] = texts.map((text, i) => ({ id: String(i), kind: 'expr', text, color: '' }));
  const parsed = rows.map(parseRow);
  return { rows, parsed, env: buildEnv(parsed) };
};
const table: Row = {
  id: 't',
  kind: 'table',
  color: '',
  xs: ['1', '2', '3'],
  ys: ['3', '5', '7'],
  regression: true,
};
const tableState: GraphState = { rows: [table], parsed: [parseRow(table)], env: {} };
const fixtures: [DesmosStep, LessonEvent, LessonEvent][] = [
  [{ type: 'read', say: '' }, { type: 'read' }, { type: 'view', view: 'home' }],
  [
    { type: 'pan', say: '', hint: '' },
    { type: 'view', view: 'pan' },
    { type: 'view', view: 'zoom' },
  ],
  [
    { type: 'zoom', say: '', hint: '' },
    { type: 'view', view: 'zoom' },
    { type: 'view', view: 'home' },
  ],
  [
    { type: 'enter', say: '', hint: '', target: 'y=2x+1' },
    { type: 'state', state: state('y=1+2x') },
    { type: 'state', state: state('y=3x+1') },
  ],
  [
    { type: 'select', say: '', hint: '', kind: 'intersection', at: [2, 5] },
    { type: 'poi', poi: { x: 2, y: 5, kind: 'intersection', rows: ['a', 'b'] } },
    { type: 'poi', poi: { x: 0, y: 1, kind: 'yint', rows: ['a'] } },
  ],
  [
    { type: 'slider', say: '', hint: '', name: 'a', value: 3 },
    { type: 'state', state: state('y=ax+1', 'a=3') },
    { type: 'state', state: state('y=ax+1', 'a=1') },
  ],
  [
    { type: 'regression', say: '', hint: '' },
    { type: 'state', state: tableState },
    { type: 'state', state: state('y=2x+1') },
  ],
  [
    { type: 'answer', say: '', hint: '', prompt: '', accept: ['(2,5)'], explain: '' },
    { type: 'answer', value: ' (2, 5) ' },
    { type: 'answer', value: '(5,2)' },
  ],
  [
    { type: 'choice', say: '', prompt: '', options: ['a', 'b'], answer: 1, explain: '' },
    { type: 'choice', index: 1 },
    { type: 'choice', index: 0 },
  ],
];
for (const [step, good, bad] of fixtures)
  test(`${step.type} accepts its action, rejects a wrong and unrelated action`, () => {
    expect(validateStep(step, good)).toBe(true);
    expect(validateStep(step, bad)).toBe(false);
    expect(validateStep(step, { type: 'answer', value: 'arbitrary click' })).toBe(false);
  });
test('a numeric equation cannot stand in for a parameterized one', () =>
  expect(
    validateStep(
      { type: 'enter', say: '', hint: '', target: 'y=ax+1' },
      { type: 'state', state: state('y=1.31x+1') },
    ),
  ).toBe(false));
test('a hidden equation cannot satisfy entry', () => {
  const g = state('y=2x+1');
  g.rows[0].hidden = true;
  expect(
    validateStep({ type: 'enter', say: '', hint: '', target: 'y=2x+1' }, { type: 'state', state: g }),
  ).toBe(false);
});
test('regression requires enough data and a fitted line', () => {
  const invalid: Row = { ...table, xs: ['1'], ys: ['3'] };
  expect(
    validateStep(
      { type: 'regression', say: '', hint: '' },
      { type: 'state', state: { rows: [invalid], parsed: [parseRow(invalid)], env: {} } },
    ),
  ).toBe(false);
});
