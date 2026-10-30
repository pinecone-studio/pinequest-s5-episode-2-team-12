// Checks every practice test in content/mock: the question schema, ids, the module shape (22 questions with
// the SAT domain split and the difficulty mix of config.ts) and each stored answer (check-answers).
// Run: bun scripts/mock/check-practice-tests.ts   (exit code 1 when something is wrong)
import { MOCK } from '../../src/features/exam/config';
import { formQuestions, PRACTICE_TESTS } from '../../src/features/exam/forms';
import { RoadmapQuestionSchema } from '../../src/features/roadmap/content/schema';
import { splitCounts } from '../../src/features/roadmap/lib/select-problems';
import { checkQuestion } from '../roadmap/check-answers';

const DIFF = { easy: 1, medium: 2, hard: 3 } as const;

export function checkPracticeTests(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const f of PRACTICE_TESTS) {
    const mods = { module1: MOCK.mix.module1, hard: MOCK.mix.hard, easy: MOCK.mix.easy } as const;
    for (const [name, mix] of Object.entries(mods)) {
      const qs = f[name as keyof typeof mods];
      if (qs.length !== MOCK.questionsPerModule) problems.push(`${f.id}.${name}: ${qs.length} questions`);
      for (const [domain, n] of Object.entries(MOCK.domainCounts)) {
        const want = splitCounts(n, mix);
        for (const [k, d] of Object.entries(DIFF)) {
          const got = qs.filter((q) => q.domain === domain && q.difficulty === d).length;
          if (got !== want[k as keyof typeof want])
            problems.push(`${f.id}.${name}: ${domain} ${k} ${got}, want ${want[k as keyof typeof want]}`);
        }
      }
    }
    for (const q of formQuestions(f)) {
      if (ids.has(q.id)) problems.push(`${q.id}: duplicate id`);
      ids.add(q.id);
      const parsed = RoadmapQuestionSchema.safeParse(q);
      if (!parsed.success) problems.push(`${q.id}: ${parsed.error.issues.map((i) => i.message).join('; ')}`);
      else
        for (const x of checkQuestion(parsed.data))
          if (x.level === 'mismatch') problems.push(`${x.id}: ${x.message}`);
    }
  }
  return problems;
}

if (import.meta.main) {
  const problems = checkPracticeTests();
  for (const p of problems) console.error(`✗ ${p}`);
  const n = PRACTICE_TESTS.reduce((s, f) => s + formQuestions(f).length, 0);
  console.log(
    `${problems.length ? '✗' : '✓'} ${PRACTICE_TESTS.length} practice tests · ${n} questions · ${problems.length} problems`,
  );
  if (problems.length) process.exitCode = 1;
}
