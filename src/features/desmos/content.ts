import { z } from 'zod';
import type { DesmosHack, DesmosLesson } from '@/types';
import d1 from './content/desmos/d1.json';
import d2 from './content/desmos/d2.json';
import d3 from './content/desmos/d3.json';
import d4 from './content/desmos/d4.json';
import d5 from './content/desmos/d5.json';
import d6 from './content/desmos/d6.json';
import d7 from './content/desmos/d7.json';
import d8 from './content/desmos/d8.json';
import d9 from './content/desmos/d9.json';
import hacks from './content/desmos/hacks.json';

const point = z.tuple([z.number().finite(), z.number().finite()]);
const base = { say: z.string().min(1) };
const guided = { ...base, hint: z.string().min(1) };
const step = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('read'), cta: z.string().optional() }),
  z.object({ ...guided, type: z.literal('pan') }),
  z.object({ ...guided, type: z.literal('zoom') }),
  z.object({ ...guided, type: z.literal('enter'), target: z.string(), demo: z.string().optional() }),
  z.object({
    ...guided,
    type: z.literal('select'),
    kind: z.enum(['root', 'yint', 'max', 'min', 'intersection', 'point']),
    at: point.optional(),
    wrong: z.string().optional(),
  }),
  z.object({
    ...guided,
    type: z.literal('slider'),
    name: z.string().regex(/^[a-wz]$/),
    value: z.number(),
    tol: z.number().nonnegative().optional(),
  }),
  z.object({ ...guided, type: z.literal('regression') }),
  z.object({
    ...guided,
    type: z.literal('answer'),
    prompt: z.string(),
    accept: z.array(z.string()).min(1),
    placeholder: z.string().optional(),
    explain: z.string(),
  }),
  z
    .object({
      ...base,
      type: z.literal('choice'),
      prompt: z.string(),
      options: z.array(z.string()).min(2),
      answer: z.number().int().nonnegative(),
      explain: z.string(),
    })
    .refine((s) => s.answer < s.options.length),
]);
const lesson: z.ZodType<DesmosLesson> = z.object({
  id: z.string(),
  no: z.number().int().positive(),
  title: z.string(),
  en: z.string(),
  skill: z.string(),
  minutes: z.number().positive(),
  xp: z.number().int().nonnegative(),
  badge: z.string().optional(),
  question: z.string().optional(),
  intro: z.string(),
  outro: z.string(),
  manual: z.string().optional(),
  featured: z.boolean().optional(),
  initial: z.array(
    z.union([z.string(), z.object({ table: z.array(point), regression: z.boolean().optional() })]),
  ),
  steps: z.array(step).min(1),
});
const hack: z.ZodType<DesmosHack> = z.object({
  title: z.string(),
  when: z.string(),
  steps: z.array(z.string()),
  rows: z.array(z.string()),
});
export const LESSONS = z.array(lesson).parse([d1, d2, d3, d4, d5, d6, d7, d8, d9]);
export const HACKS = z.array(hack).parse(hacks);
