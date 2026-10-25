import { describe, expect, test } from 'bun:test';
import katex from 'katex';
import { DESMOS } from '@/mocks/desmos';
import { nodeById } from '@/mocks/stages';
import { STOPS } from '../stops';
import { TOPICS } from '../topics';
import { cardRef, stopDetail } from './details';
import { GUIDES } from './guides';
import { PLACES } from './places';

describe('stop panel content', () => {
  test('every stop has a place line and every topic a guide, all unreviewed drafts', () => {
    expect(PLACES.map((p) => p.no)).toEqual(STOPS.map((s) => s.no));
    expect(GUIDES.map((g) => g.topicId)).toEqual(TOPICS.map((t) => t.id));
    for (const x of [...PLACES, ...GUIDES]) expect(x.reviewed).toBe(false);
    for (const p of PLACES) expect(p.fact.startsWith(STOPS[p.no - 1].place)).toBe(true);
  });

  test('guides have a 2–3 sentence summary and 2–5 goals', () => {
    for (const g of GUIDES) {
      const sentences = g.summary.split(/[.!?](\s|$)/).filter((s) => s.trim().length > 3).length;
      expect({ topic: g.topicId, ok: sentences >= 2 && sentences <= 3 }).toEqual({
        topic: g.topicId,
        ok: true,
      });
      expect(g.goals.length).toBeGreaterThanOrEqual(2);
      expect(g.goals.length).toBeLessThanOrEqual(5);
    }
  });

  test('every formula renders with KaTeX', () => {
    for (const g of GUIDES)
      for (const f of g.formulas) expect(() => katex.renderToString(f, { throwOnError: true })).not.toThrow();
  });

  test('every link resolves: flashcards, Desmos lessons, journey lessons', () => {
    for (const g of GUIDES) {
      for (const c of g.cards) expect({ ref: c, ok: cardRef(c) !== null }).toEqual({ ref: c, ok: true });
      for (const d of g.desmos) expect(DESMOS.some((x) => x.id === d)).toBe(true);
      for (const l of g.lessons) expect(nodeById(l)).toBeDefined();
    }
  });

  test('stopDetail assembles intros and links for a stop', () => {
    const d = stopDetail(9);
    expect(d.place?.fact).toContain('Хархорин');
    expect(d.intros.length).toBeGreaterThan(0);
    expect(stopDetail(1).lessons.map((l) => l.id)).toContain('s2-l2');
    expect(stopDetail(25).cards.length).toBeGreaterThan(0);
  });
});
