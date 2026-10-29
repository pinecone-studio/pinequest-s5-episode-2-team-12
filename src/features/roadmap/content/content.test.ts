import { describe, expect, test } from 'bun:test';
import katex from 'katex';
import { checkQuestion } from '../../../../scripts/roadmap/check-answers';
import { ROADMAP } from '../config';
import { module1, module2 } from '../lib/placement';
import { TOPICS } from '../topics';
import { AUTHORED, INTROS, PLACEMENT, placementPool, stopPool } from './bank';
import { IntrosSchema, validateBank } from './schema';

describe('roadmap bank', () => {
  test('every authored and placement question matches the schema, ids unique', () => {
    expect(validateBank([...AUTHORED, ...PLACEMENT])).toEqual([]);
  });

  test('seed: at least 2 easy, 2 medium, 2 hard authored questions per topic', () => {
    for (const t of TOPICS) {
      for (const d of [1, 2, 3]) {
        const n = AUTHORED.filter(
          (q) => q.topicId === t.id && q.difficulty === d && q.pool === 'stop',
        ).length;
        expect({ topic: t.id, difficulty: d, ok: n >= 2 }).toEqual({ topic: t.id, difficulty: d, ok: true });
      }
    }
  });

  test('seed questions are original and unreviewed', () => {
    for (const q of [...AUTHORED, ...PLACEMENT]) {
      expect(q.source).toBe('original');
      expect(q.reviewed).toBe(false);
    }
  });

  test('placement: 13 medium module-1 items and both module-2 variants', () => {
    const items = placementPool(true);
    expect(module1(items)).toHaveLength(13);
    expect(module2(items, 'easy')).toHaveLength(13);
    expect(module2(items, 'hard')).toHaveLength(13);
    expect(PLACEMENT).toHaveLength(
      ROADMAP.placement.module1Topics.length + ROADMAP.placement.module2Topics.length * 2,
    );
  });

  test('no stored answer fails its numeric check', () => {
    const mismatches = [...AUTHORED, ...PLACEMENT]
      .flatMap(checkQuestion)
      .filter((f) => f.level === 'mismatch');
    expect(mismatches).toEqual([]);
  });

  test('most seed questions are machine-checked', () => {
    const all = [...AUTHORED, ...PLACEMENT];
    const manual = new Set(
      all
        .flatMap(checkQuestion)
        .filter((f) => f.level === 'manual')
        .map((f) => f.id),
    );
    expect(manual.size / all.length).toBeLessThan(0.25);
  });

  test('intros: 2–10 screens for every topic', () => {
    expect(IntrosSchema.safeParse(Object.fromEntries(Object.entries(INTROS))).success).toBe(true);
    for (const t of TOPICS) expect(INTROS[t.id]?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  test('every lesson has a worked example and self-check, and its math renders', () => {
    for (const topic of TOPICS) {
      const screens = INTROS[topic.id];
      expect(screens.some((s) => s.kind === 'example')).toBe(true);
      expect(screens.at(-1)?.checkAnswer).toBeTruthy();
      for (const screen of screens) {
        for (const text of [screen.body ?? '', screen.checkAnswer ?? '']) {
          for (const match of text.matchAll(/\$([^$]+)\$/g)) {
            expect(() => katex.renderToString(match[1], { throwOnError: true })).not.toThrow();
          }
        }
      }
    }
  });

  test('the review gate hides unreviewed questions in production', () => {
    expect(stopPool(1, false).every((q) => q.reviewed)).toBe(true);
    expect(stopPool(1, true).length).toBeGreaterThan(stopPool(1, false).length);
  });
});
