import type { DesmosStep } from '@/types';
import type { GraphState, ViewEvent } from '../components/graph-calc';
import { equivalent, type Poi, parseRow } from './graph';

export type LessonEvent =
  | { type: 'state'; state: GraphState }
  | { type: 'poi'; poi: Poi }
  | { type: 'view'; view: ViewEvent }
  | { type: 'read' }
  | { type: 'answer'; value: string }
  | { type: 'choice'; index: number };

export const normalizeAnswer = (s: string) => s.trim().replace(/\s/g, '').replace(/[−–]/g, '-').toLowerCase();

/** Pure validator shared by the runner and tests. Unrelated events never advance. */
export function validateStep(step: DesmosStep, event: LessonEvent): boolean {
  switch (step.type) {
    case 'read':
      return event.type === 'read';
    case 'pan':
    case 'zoom':
      return event.type === 'view' && event.view === step.type;
    case 'select':
      return (
        event.type === 'poi' &&
        event.poi.kind === step.kind &&
        (!step.at || Math.hypot(event.poi.x - step.at[0], event.poi.y - step.at[1]) <= 1e-3)
      );
    case 'answer':
      return (
        event.type === 'answer' &&
        step.accept.some((s) => normalizeAnswer(s) === normalizeAnswer(event.value))
      );
    case 'choice':
      return event.type === 'choice' && event.index === step.answer;
    case 'slider':
      return (
        event.type === 'state' &&
        Number.isFinite(event.state.env[step.name]) &&
        Math.abs(event.state.env[step.name] - step.value) <= (step.tol ?? 0.05) &&
        event.state.parsed.some(
          (p, i) => p.kind === 'slider' && p.name === step.name && !event.state.rows[i].hidden,
        )
      );
    case 'regression':
      return (
        event.type === 'state' &&
        event.state.parsed.some((p, i) => p.kind === 'table' && !!p.reg && !event.state.rows[i].hidden)
      );
    case 'enter': {
      if (event.type !== 'state') return false;
      const { rows, parsed, env } = event.state;
      const target = parseRow({ id: 'target', kind: 'expr', text: step.target, color: '' });
      // Vary constants as well as x: a numeric line must not satisfy y=ax+1.
      const names = new Set<string>();
      for (const p of [...parsed, target]) if ('deps' in p) for (const name of p.deps) names.add(name);
      return parsed.some(
        (p, i) =>
          !rows[i].hidden &&
          [0.73, 1.31, -2.17].every((probe) => {
            const testEnv = { ...env };
            [...names].sort().forEach((name, j) => {
              testEnv[name] = probe + j * 0.37;
            });
            return equivalent(p, target, testEnv);
          }),
      );
    }
  }
}
