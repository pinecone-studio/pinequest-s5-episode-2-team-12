// Алдааны дэвтэр · «Суугийн дүгнэлт». POST { attempts?, mistakes? } (demo browsers send their own data;
// signed-in students are read from the database) → the patterns in the student's recent mistakes.
// Суу's analyze skill writes it (checked like the kit scores it), or the rule engine when Суу is off/wrong.

import { questionFacts, StudentDataSchema, studentData } from '@/server/ai/student-data';
import { analyzeInput } from '@/server/ai/student-input';
import { type SkillSource, suuAnalyze } from '@/server/ai/suu-skills';
import type { AnalyzeOutput } from '../../../../../ai/v2/analyze';

export const maxDuration = 60;

export type AnalyzeResponse =
  | { analysis: AnalyzeOutput; source: SkillSource; mistakes: number; answered: number }
  | { analysis: null; source: 'none'; mistakes: 0; answered: number };

export async function POST(req: Request) {
  const parsed = StudentDataSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'bad_request' }, { status: 400 });
  const data = await studentData(parsed.data);
  const input = analyzeInput(data.mistakes, data.attempts, questionFacts);
  if (!input.mistakes.length) {
    return Response.json({
      analysis: null,
      source: 'none',
      mistakes: 0,
      answered: input.answered,
    } satisfies AnalyzeResponse);
  }
  const res = await suuAnalyze(input);
  return Response.json({
    analysis: res.result,
    source: res.source,
    mistakes: input.mistakes.length,
    answered: input.answered,
  } satisfies AnalyzeResponse);
}
