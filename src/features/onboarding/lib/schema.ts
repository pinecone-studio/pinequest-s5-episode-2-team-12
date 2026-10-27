import { z } from 'zod';
import { dayKey, zonedMidnight } from '@/lib/time';

export const OnboardingSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    satExp: z.enum(['none', 'some', 'taken']),
    lastMathScore: z.number().int().min(200).max(800).multipleOf(10).nullable(),
    target: z.number().int().min(200).max(800).multipleOf(10),
    examDate: z
      .string()
      .refine((date) => !date || (Number.isFinite(zonedMidnight(date)) && date >= dayKey())),
    confidence: z.number().int().min(1).max(5),
    desmos: z.enum(['never', 'little', 'often']),
    studyMinutes: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
    start: z.enum(['foundations', 'english', 'desmos']),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.satExp !== 'taken' && data.lastMathScore !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['lastMathScore'],
        message: 'Only applicable after taking the SAT',
      });
    }
  });
export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export function onboardingRow(userId: string, data: OnboardingInput) {
  return {
    id: userId,
    name: data.name,
    sat_exp: data.satExp,
    last_math_score: data.lastMathScore,
    target: data.target,
    exam_date: data.examDate || null,
    confidence: data.confidence,
    desmos: data.desmos,
    study_minutes: data.studyMinutes,
    start: data.start,
    onboarded: true,
  };
}
