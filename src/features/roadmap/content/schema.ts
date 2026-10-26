// Schema of the roadmap question bank (content/roadmap/<domain>/*.json). Used by the loader, the import script
// and the admin page. Questions are ORIGINAL Suprep items; only College Board's taxonomy (domain, skill,
// difficulty, format) is reused.
import { z } from 'zod';
import { topicById } from '../topics';

const DOMAIN = z.enum(['alg', 'adv', 'psda', 'geo']);

/** Machine check for scripts/roadmap/check-answers.ts. Expressions use x, ^, sqrt, pi, implicit ×. */
export const VerifySchema = z.union([
  /** `expr` evaluates to the correct answer. */
  z.object({ value: z.string().min(1) }),
  /** substituting the answer for `var` makes `eq` ("left = right") true. */
  z.object({ sub: z.object({ var: z.string().length(1), eq: z.string().includes('=') }) }),
]);

export const RoadmapQuestionSchema = z
  .object({
    id: z.string().regex(/^rm[a-z0-9-]+$/, 'id must start with "rm"'),
    topicId: z.number().int().min(1).max(26),
    domain: DOMAIN,
    skill: z.string().min(1),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    format: z.enum(['mcq', 'spr']),
    pool: z.enum(['stop', 'placement']),
    /** English stem as on the SAT, inline math in $…$. */
    prompt: z.string().min(8),
    /** Mongolian translation of the stem. */
    mn: z.string().min(4),
    choices: z.array(z.string().min(1)).length(4).optional(),
    answer: z.union([z.number().int().min(0).max(3), z.array(z.string().min(1)).min(1)]),
    /** Mongolian, step by step. */
    explain: z.string().min(10),
    hint: z.string().min(4),
    desmos: z.object({ rows: z.array(z.string()), tip: z.string().min(4) }).optional(),
    figure: z.string().optional(),
    vocab: z.array(z.string()).optional(),
    why: z.record(z.string(), z.string()).optional(),
    verify: VerifySchema.optional(),
    source: z.literal('original'),
    reviewed: z.boolean(),
    author: z.string().min(1),
    createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  })
  .superRefine((q, ctx) => {
    const topic = topicById(q.topicId);
    if (topic) {
      const skills = [{ domain: topic.domain, skill: topic.cbSkill }, ...(topic.relatedSkills ?? [])];
      if (!skills.some((s) => s.domain === q.domain && s.skill === q.skill)) {
        ctx.addIssue({ code: 'custom', message: `domain and skill must belong to topic ${topic.id}` });
      }
    }
    if (q.format === 'mcq') {
      if (!q.choices) ctx.addIssue({ code: 'custom', message: 'mcq needs 4 choices' });
      if (typeof q.answer !== 'number')
        ctx.addIssue({ code: 'custom', message: 'mcq answer is a choice index 0–3' });
      if (q.choices && new Set(q.choices).size !== q.choices.length) {
        ctx.addIssue({ code: 'custom', message: 'mcq choices must be distinct' });
      }
    } else {
      if (q.choices) ctx.addIssue({ code: 'custom', message: 'spr has no choices' });
      if (!Array.isArray(q.answer))
        ctx.addIssue({ code: 'custom', message: 'spr answer is a list of accepted strings' });
    }
  });

export type RoadmapQuestion = z.infer<typeof RoadmapQuestionSchema>;

export const IntroScreenSchema = z.object({
  title: z.string().min(2),
  /** Rich text: $…$ TeX and **bold**. */
  body: z.string().min(10),
  kind: z.enum(['idea', 'example', 'desmos']),
  /** A self-check solution revealed only when the learner asks. */
  checkAnswer: z.string().min(10).optional(),
});
export const IntrosSchema = z.record(z.string().regex(/^\d+$/), z.array(IntroScreenSchema).min(2).max(4));
export type IntroScreen = z.infer<typeof IntroScreenSchema>;

/** Validate a whole bank; returns readable problems (empty = valid). */
export function validateBank(items: unknown[]): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  items.forEach((raw, i) => {
    const r = RoadmapQuestionSchema.safeParse(raw);
    const label = (raw as { id?: string })?.id ?? `#${i}`;
    if (!r.success) {
      for (const issue of r.error.issues)
        problems.push(`${label}: ${issue.path.join('.') || '-'} ${issue.message}`);
      return;
    }
    if (ids.has(r.data.id)) problems.push(`${label}: duplicate id`);
    ids.add(r.data.id);
  });
  return problems;
}
