import { expect, test } from 'bun:test';
import { getContext, listMessages } from './queries';

test('context lookup with general fallback', async () => {
  expect((await getContext('question', 'a2')).problem).toContain('y=2x+1');
  expect((await getContext('desmos', 'd3')).kind).toBe('desmos');
  const rm = await getContext('question', 'rm01-e1');
  expect(rm.title).toBe('Нэг хувьсагчтай шугаман тэгшитгэл');
  expect(rm.problem?.length).toBeGreaterThan(8);
  expect(await getContext('question', 'missing')).toEqual({ kind: 'general', title: 'SAT Math' });
  expect(await listMessages('t1')).toEqual([]);
});
