import { describe, expect, test } from 'bun:test';
import { TOPICS } from '@/features/roadmap/topics';
import { type Answered, CLUSTERS, clusterRadar, DOMAIN_AXES, domainRadar, resolve } from './radar';

const NOW = Date.parse('2026-10-26T00:00:00Z');
const DAY = 86_400_000;
const a = (topicId: number, correct: boolean, daysAgo = 0, difficulty: 1 | 2 | 3 = 2): Answered => ({
  topicId,
  difficulty,
  correct,
  at: NOW - daysAgo * DAY,
});

describe('skill radar', () => {
  test('8 clusters cover the 26 topics once, each inside the topic’s own SAT domain', () => {
    const all = CLUSTERS.flatMap((c) => c.topics).sort((x, y) => x - y);
    expect(all).toEqual(TOPICS.map((t) => t.id));
    for (const c of CLUSTERS)
      for (const id of c.topics) expect(TOPICS.find((t) => t.id === id)?.domain).toBe(c.domain);
    expect(CLUSTERS).toHaveLength(8);
  });

  test('too few answers → no value; a prior keeps a perfect streak below 100%', () => {
    expect(clusterRadar([a(3, true), a(6, true)], NOW)[0]).toEqual({ id: 'linEq', n: 2, value: null });
    const v = clusterRadar([a(3, true), a(6, true), a(14, true)], NOW)[0].value!;
    expect(v).toBeGreaterThan(0.7);
    expect(v).toBeLessThan(1);
  });

  test('recent answers count more than old ones', () => {
    const improving = [
      a(7, false, 60),
      a(7, false, 60),
      a(7, false, 60),
      a(7, true, 0),
      a(7, true, 0),
      a(7, true, 0),
    ];
    const declining = [
      a(7, true, 60),
      a(7, true, 60),
      a(7, true, 60),
      a(7, false, 0),
      a(7, false, 0),
      a(7, false, 0),
    ];
    expect(clusterRadar(improving, NOW)[1].value!).toBeGreaterThan(0.6);
    expect(clusterRadar(declining, NOW)[1].value!).toBeLessThan(0.4);
  });

  test('harder correct answers weigh more', () => {
    const hardRight = [a(17, true, 0, 3), a(18, false, 0, 1), a(19, true, 0, 3), a(20, false, 0, 1)];
    const easyRight = [a(17, true, 0, 1), a(18, false, 0, 3), a(19, true, 0, 1), a(20, false, 0, 3)];
    expect(clusterRadar(hardRight, NOW)[7].value!).toBeGreaterThan(clusterRadar(easyRight, NOW)[7].value!);
  });

  test('the 4-domain view rolls clusters up', () => {
    const answers = [a(15, true), a(16, true), a(9, false), a(10, true), a(24, false), a(26, false)];
    const d = domainRadar(answers, NOW);
    expect(d.map((x) => x.id)).toEqual(DOMAIN_AXES);
    expect(d.find((x) => x.id === 'adv')).toMatchObject({ n: 3 });
    expect(d.find((x) => x.id === 'psda')).toMatchObject({ n: 3 });
    expect(d.find((x) => x.id === 'alg')?.value).toBeNull();
  });

  test('resolve maps question ids to topics and difficulties, dropping unknown ones', () => {
    const r = resolve(
      [
        { qid: 'q1', correct: true, at: NOW },
        { qid: 'zzz', correct: false, at: NOW },
        { qid: 'other', correct: false, at: NOW, topicId: 4 },
      ],
      { q1: [9, 3] },
    );
    expect(r).toEqual([
      { topicId: 9, difficulty: 3, correct: true, at: NOW },
      { topicId: 4, difficulty: 2, correct: false, at: NOW },
    ]);
  });
});
