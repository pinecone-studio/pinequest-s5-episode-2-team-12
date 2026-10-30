// Server-only construction: use the real practice-test engine so the saved score and review agree.

import { DOMAINS, MOCK } from '@/features/exam/config';
import { beginModule2, mockBank, submitModule } from '@/features/exam/engine';
import { PRACTICE_TESTS } from '@/features/exam/forms';
import type { MockAttempt } from '@/features/exam/lib/mock';
import { placementPool } from '@/features/roadmap/content/bank';
import { module1, module2, routeModule2 } from '@/features/roadmap/lib/placement';
import { gradePlacementSubmission } from '@/features/roadmap/lib/submit';
import { TUYA_PROFILE } from './profile';
import { tuyaRoadmap } from './roadmap';

export function tuyaPracticeTest(now = Date.now(), earlier = false): MockAttempt {
  const start = now - (earlier ? 9 : 2) * 86400000;
  const form = PRACTICE_TESTS[0];
  // A saved sample, not a new live test: unreviewed practice forms remain gated for real attempts.
  let attempt: MockAttempt = {
    id: earlier ? 'local-tuya-earlier-mock' : 'local-tuya-practice-test-1',
    formId: form.id,
    startedAt: new Date(start).toISOString(),
    finishedAt: null,
    route: null,
    modules: [
      {
        no: 1,
        ids: form.module1.map((q) => q.id),
        answers: [],
        startedAt: new Date(start).toISOString(),
        endsAt: new Date(start + MOCK.moduleMinutes * 60000).toISOString(),
        submittedAt: null,
      },
    ],
    score: null,
    raw: { correct: 0, total: 0 },
    domains: Object.fromEntries(DOMAINS.map((d) => [d, { correct: 0, total: 0 }])) as MockAttempt['domains'],
    timeUsedSec: 0,
    flagged: false,
  };
  const { bank } = mockBank();
  for (const no of [1, 2] as const) {
    const module = attempt.modules.find((m) => m.no === no)!;
    const answers = module.ids.map((qid, i) => {
      const question = bank.get(qid)!;
      const right = Array.isArray(question.answer) ? question.answer[0] : String(question.answer);
      return { qid, answer: (earlier ? i % 5 >= 3 : i % 5 === 4) ? '__wrong__' : right, timeMs: 60000 };
    });
    const submitted = submitModule(attempt, no, answers, Date.parse(module.startedAt) + 22 * 60000);
    if ('error' in submitted) throw new Error(submitted.error);
    attempt = submitted.attempt;
    if (no === 1) {
      const second = beginModule2(attempt, Date.parse(attempt.modules[0].submittedAt!) + 10 * 60000);
      if ('error' in second) throw new Error(second.error);
      attempt = second.attempt;
    }
  }
  if (earlier) delete attempt.formId;
  return attempt;
}

export function tuyaSeed(now = Date.now()) {
  const roadmap = tuyaRoadmap(now);
  const practiceTest = tuyaPracticeTest(now);
  const pool = placementPool(true);
  const first = module1(pool);
  const second = module2(pool, routeModule2(first.filter((_, i) => i % 4 !== 3).length));
  const answers = [...first, ...second].map((q, i) => ({
    qid: q.id,
    answer: i % 4 === 3 ? '__wrong__' : Array.isArray(q.answer) ? q.answer[0] : String(q.answer),
    timeMs: 60000,
  }));
  const placement = gradePlacementSubmission(pool, answers, new Date(now - 12 * 86400000).toISOString());
  if ('error' in placement) throw new Error(placement.error);
  roadmap.state.placement = placement.result;
  roadmap.state.mastery = placement.result.mastery;
  roadmap.state.level = placement.result.level;
  roadmap.history = placement.attempts;
  return { profile: TUYA_PROFILE, roadmap, mocks: [practiceTest, tuyaPracticeTest(now, true)] };
}
export type DemoSeed = ReturnType<typeof tuyaSeed>;
