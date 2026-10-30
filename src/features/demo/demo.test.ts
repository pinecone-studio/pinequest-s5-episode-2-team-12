import { expect, test } from 'bun:test';
import { mockBank } from '@/features/exam/engine';
import { loadLocalMocks } from '@/features/exam/lib/local-mocks';
import { isCorrect } from '@/features/roadmap/lib/grade';
import { canOpenStop, frontier } from '@/features/roadmap/lib/unlock';
import { BOTS } from '@/features/social/lib/bots';
import { initializeTuyaDemo } from './bootstrap';
import { tuyaSeed } from './seed';

const now = Date.parse('2026-10-30T00:00:00Z');
test('Tuya has completed onboarding, ten unlocked roadmap levels, and a graded Practice Test 1', () => {
  const seed = tuyaSeed(now);
  expect(seed.profile).toMatchObject({ name: 'Tuya', onboarded: true, studyMinutes: 30 });
  expect(frontier(seed.roadmap.state.stops)).toBe(10);
  expect(seed.roadmap.state.stops.filter((s) => canOpenStop(seed.roadmap.state.stops, s.no))).toHaveLength(
    10,
  );
  expect(seed.roadmap.state.placement?.skipped).toBe(false);
  const [mock] = seed.mocks;
  const previous = seed.mocks[1];
  expect(Date.parse(previous.finishedAt!)).toBeLessThan(Date.parse(mock.startedAt));
  expect(previous.score!).toBeLessThan(mock.score!);
  expect(previous.flagged).toBe(false);
  expect(mock.formId).toBe('pt1');
  expect(mock.finishedAt).not.toBeNull();
  expect(mock.flagged).toBe(false);
  expect(mock.raw.total).toBe(44);
  expect(mock.score).toBeGreaterThanOrEqual(200);
  const { bank } = mockBank();
  for (const module of mock.modules) {
    for (const a of module.answers) expect(a.correct).toBe(isCorrect(bank.get(a.qid)!, a.answer));
  }
  expect(BOTS).toHaveLength(49);
  expect(new Set(BOTS.map((b) => b.id)).size).toBe(49);
});

test('demo initialization upgrades the old empty scenario once and preserves subsequent progress', () => {
  const map = new Map<string, string>();
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
  initializeTuyaDemo(storage, tuyaSeed(now));
  expect(JSON.parse(map.get('suprep-settings')!).name).toBe('Tuya');
  expect(JSON.parse(map.get('suprep:mocks:v1')!)).toHaveLength(2);
  map.set('suprep:roadmap:v1', 'new progress');
  initializeTuyaDemo(storage, tuyaSeed(now + 86400000));
  expect(map.get('suprep:roadmap:v1')).toBe('new progress');
});

test('existing demo history gains an earlier comparison without duplicating or overwriting attempts', () => {
  const before = localStorage.getItem('suprep:mocks:v1');
  try {
    const current = tuyaSeed(now).mocks[0];
    localStorage.setItem('suprep:mocks:v1', JSON.stringify([current]));
    const upgraded = loadLocalMocks();
    expect(upgraded).toHaveLength(2);
    expect(upgraded[0]).toEqual(current);
    expect(upgraded[1].score!).toBeLessThan(current.score!);
    expect(Date.parse(upgraded[1].finishedAt!)).toBeLessThan(Date.parse(current.startedAt));
    expect(loadLocalMocks()).toEqual(upgraded);
    localStorage.setItem('suprep:mocks:v1', JSON.stringify([{ ...current, id: 'another-student' }]));
    expect(loadLocalMocks()).toHaveLength(1);
  } finally {
    if (before === null) localStorage.removeItem('suprep:mocks:v1');
    else localStorage.setItem('suprep:mocks:v1', before);
  }
});
