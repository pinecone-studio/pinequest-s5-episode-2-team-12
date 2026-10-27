'use client';
// Demo mode (no account): the student's own answers and mistakes from localStorage — the roadmap history and
// finished mocks. The mistake notebook shows them; Суу's planner and analysis get them (POST /api/suu/*).
import { loadLocalMocks } from '@/features/exam/lib/local-mocks';
import { loadLocalRoadmap } from '@/features/roadmap/lib/local-store';
import type { Entry } from './notebook';

/** Demo: wrong answers from the roadmap history and finished mocks. */
export function localEntries(): Entry[] {
  const road = loadLocalRoadmap()
    .history.filter((h) => !h.correct)
    .map((h) => ({ qid: h.qid, chosen: '', source: 'stop' as const, at: h.at }));
  const mocks = loadLocalMocks().flatMap((m) =>
    m.modules.flatMap((mod) =>
      mod.answers
        .filter((a) => a.answer && !a.correct)
        .map((a) => ({
          qid: a.qid,
          chosen: a.answer,
          source: 'mock' as const,
          at: Date.parse(m.finishedAt ?? m.startedAt),
        })),
    ),
  );
  return [...road, ...mocks];
}

/** What a demo browser sends to /api/suu/planner and /api/suu/analyze (signed-in students are read on the server). */
export function localStudentData() {
  const attempts = loadLocalRoadmap()
    .history.slice(-3000)
    .map((h) => ({
      qid: h.qid,
      topicId: h.topicId,
      correct: h.correct,
      timeMs: Math.round(h.timeMs || 0),
      at: h.at,
    }));
  const mistakes = localEntries()
    .slice(-1000)
    .map((e) => ({ qid: e.qid, source: e.source, at: e.at }));
  return { attempts, mistakes };
}
