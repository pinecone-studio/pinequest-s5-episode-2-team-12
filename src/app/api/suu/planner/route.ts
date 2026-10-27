// AI төлөвлөгөө · POST { today, examDate, current, target, hoursPerDay, note?, weakIds?, attempts?, mistakes? }
// → a 7-day plan from the student's own answers (topic accuracy, time, trend), the habits in their mistakes and
// their note ("Мягмар гарагт завгүй"). Суу's planner skill writes it (checked like the kit scores it), or the
// rule engine when Суу is off/wrong. Demo browsers send their own data; signed-in students are read from the DB.
import { z } from 'zod';
import { questionFacts, StudentDataSchema, studentData } from '@/server/ai/student-data';
import { analyzeInput, plannerInput } from '@/server/ai/student-input';
import { type SkillSource, suuPlan } from '@/server/ai/suu-skills';
import type { PlannerInput, PlannerOutput } from '../../../../../ai/v2/planner';

export const maxDuration = 60;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = StudentDataSchema.extend({
  today: day,
  examDate: day,
  current: z.number().min(200).max(800),
  target: z.number().min(200).max(800),
  hoursPerDay: z.number().min(0.5).max(6),
  note: z.string().max(300).optional(),
  weakIds: z.array(z.number().int().min(1).max(26)).max(26).default([]),
});

export type PlannerResponse = {
  plan: PlannerOutput;
  source: SkillSource;
  input: Pick<PlannerInput, 'days' | 'daysLeft' | 'topics'>;
};

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'bad_request' }, { status: 400 });
  const { attempts: _a, mistakes: _m, ...form } = parsed.data;
  if (form.examDate <= form.today) return Response.json({ error: 'exam_passed' }, { status: 400 });
  const data = await studentData({ attempts: parsed.data.attempts, mistakes: parsed.data.mistakes });
  const input = plannerInput(form, data.attempts, analyzeInput(data.mistakes, data.attempts, questionFacts));
  const res = await suuPlan(input);
  return Response.json({
    plan: res.result,
    source: res.source,
    input: { days: input.days, daysLeft: input.daysLeft, topics: input.topics },
  } satisfies PlannerResponse);
}
