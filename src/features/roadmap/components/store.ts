'use client';
// One API for the roadmap screens: Server Actions when Supabase is configured, localStorage in demo mode.
// Both paths grade with lib/submit.ts, so demo and production behave the same.
import { useCallback, useEffect, useState } from 'react';
import type { Question } from '@/types';
import { type StopOutcome, skipPlacement, submitPlacement, submitStop } from '../actions';
import { ROADMAP } from '../config';
import { loadLocalRoadmap, saveLocalRoadmap } from '../lib/local-store';
import { skippedResult } from '../lib/placement';
import { initialState, withAttempt, withPlacement } from '../lib/state';
import { gradePlacementSubmission, gradeStopSubmission, type SubmittedAnswer } from '../lib/submit';
import type { PlacementResult, ProblemAttempt, RoadmapState } from '../types';

export type Loaded = { state: RoadmapState; xp: number; history: ProblemAttempt[]; ready: boolean };

/** Current roadmap state. Server mode: what the page loaded. Demo: localStorage (after mount). */
export function useRoadmapState(demo: boolean, server: RoadmapState | null): Loaded & { reload: () => void } {
  const [local, setLocal] = useState<Loaded>({
    state: server ?? initialState(),
    xp: 0,
    history: [],
    ready: !demo,
  });
  const reload = useCallback(() => {
    if (!demo) return;
    const l = loadLocalRoadmap();
    setLocal({ state: l.state, xp: l.xp, history: l.history, ready: true });
  }, [demo]);
  useEffect(() => {
    if (demo) reload();
    else if (server) setLocal((x) => ({ ...x, state: server, ready: true }));
  }, [demo, reload, server]);
  return { ...local, reload };
}

export async function skip(demo: boolean): Promise<{ ok: boolean }> {
  if (!demo) {
    const r = await skipPlacement();
    if (r.ok || r.reason !== 'demo_mode') return { ok: r.ok };
  }
  const l = loadLocalRoadmap();
  saveLocalRoadmap({ ...l, state: withPlacement(l.state, skippedResult()) });
  return { ok: true };
}

export type PlacementSave = { ok: true; result: PlacementResult; xp: number } | { ok: false; reason: string };

export async function savePlacement(
  demo: boolean,
  items: Question[],
  answers: SubmittedAnswer[],
  startedAt: string,
): Promise<PlacementSave> {
  if (!demo) {
    const r = await submitPlacement({ answers, startedAt });
    if (r.ok || r.reason !== 'demo_mode') return r;
  }
  const graded = gradePlacementSubmission(items, answers);
  if ('error' in graded) return { ok: false, reason: graded.error };
  const l = loadLocalRoadmap();
  const first = !l.state.placement || l.state.placement.skipped;
  saveLocalRoadmap({
    ...l,
    state: withPlacement(l.state, graded.result),
    history: [...l.history, ...graded.attempts],
    xp: l.xp + (first ? ROADMAP.xp.placement : 0),
  });
  return { ok: true, result: graded.result, xp: first ? ROADMAP.xp.placement : 0 };
}

export type StopSave = { ok: true; outcome: StopOutcome } | { ok: false; reason: string };

export async function saveStop(
  demo: boolean,
  no: number,
  testOut: boolean,
  pool: Question[],
  answers: SubmittedAnswer[],
): Promise<StopSave> {
  if (!demo) {
    const r = await submitStop({ no, testOut, answers });
    if (r.ok || r.reason !== 'demo_mode') return r;
  }
  const l = loadLocalRoadmap();
  const graded = gradeStopSubmission(l.state, no, testOut, pool, answers);
  if ('error' in graded) return { ok: false, reason: graded.error };
  const out = withAttempt(l.state, no, graded.result, new Date().toISOString());
  const badges = out.badges.filter((b) => !l.badges.includes(b));
  saveLocalRoadmap({
    state: out.state,
    history: [...l.history, ...graded.attempts],
    xp: l.xp + out.xp,
    badges: [...l.badges, ...badges],
  });
  return {
    ok: true,
    outcome: {
      passed: graded.result.passed,
      stars: graded.result.stars,
      testOut: graded.result.testOut,
      correct: graded.correct,
      total: graded.total,
      xp: out.xp,
      badges,
      finishedAll: out.finishedAll,
    },
  };
}
