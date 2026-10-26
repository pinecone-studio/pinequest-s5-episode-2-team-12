import { describe, expect, test } from 'bun:test';
import { DAY_MS } from '@/lib/time';
import { afterReview, buildNotebook, dueNotes, type Entry, RESOLVED_AT_DAYS, summary } from './notebook';

const NOW = Date.parse('2026-10-26T02:00:00Z');
const e = (qid: string, at: number, chosen = '1'): Entry => ({ qid, chosen, source: 'stop', at });

describe('mistake notebook', () => {
  test('one note per question, the latest miss wins, new misses are due now', () => {
    const notes = buildNotebook([e('a', NOW - DAY_MS, '1'), e('a', NOW, '2'), e('b', NOW - 2 * DAY_MS)], {});
    expect(notes).toHaveLength(2);
    expect(notes.find((n) => n.qid === 'a')?.chosen).toBe('2');
    expect(dueNotes(notes, NOW).map((n) => n.qid)).toEqual(['b', 'a']);
  });

  test('right answers push a note out; wrong ones bring it back in minutes', () => {
    const [n] = buildNotebook([e('a', NOW)], {});
    const ok = afterReview(n.state, true, NOW);
    expect(ok.interval).toBe(1);
    const bad = afterReview(ok, false, NOW + DAY_MS);
    expect(bad.interval).toBe(0);
    expect(bad.due).toBe(NOW + DAY_MS + 10 * 60_000);
  });

  test('a note resolves once its interval is three weeks', () => {
    let s = buildNotebook([e('a', NOW)], {})[0].state;
    let t = NOW;
    while (!s.resolved) {
      s = afterReview(s, true, t);
      t = s.due;
    }
    expect(s.interval).toBeGreaterThanOrEqual(RESOLVED_AT_DAYS);
    const notes = buildNotebook([e('a', NOW)], { a: { ...s, reviewedAt: NOW + DAY_MS } });
    expect(summary(notes, t)).toEqual({ total: 1, due: 0, resolved: 1 });
  });

  test('missing the question again after reviewing it reopens the note', () => {
    const reviewed = {
      ...afterReview(buildNotebook([e('a', NOW)], {})[0].state, true, NOW),
      reviewedAt: NOW,
    };
    const notes = buildNotebook([e('a', NOW), e('a', NOW + 2 * DAY_MS, '3')], { a: reviewed });
    expect(notes[0].state.reps).toBe(0);
    expect(dueNotes(notes, NOW + 2 * DAY_MS)).toHaveLength(1);
  });
});
