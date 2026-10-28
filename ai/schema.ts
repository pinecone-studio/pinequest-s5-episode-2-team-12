// Data contracts for the AI pipeline. H2–H4 extend these; tests keep them honest.
import { z } from 'zod';

export const Source = z.object({
  id: z.string(),
  title: z.string(),
  license: z.string(),
  allowed: z.boolean(),
  path: z.string().optional(),
  url: z.string().url().optional(),
});
export type Source = z.infer<typeof Source>;

/** One cleaned question, same shape as src/types Question plus provenance. */
export const SourceQuestion = z.object({
  id: z.string(),
  source: z.string(),
  domain: z.enum(['alg', 'adv', 'psda', 'geo']),
  skill: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  prompt: z.string().min(1),
  choices: z.array(z.string()).optional(),
  answer: z.union([z.number().int().nonnegative(), z.array(z.string()).min(1)]),
  explain: z.string(),
});
export type SourceQuestion = z.infer<typeof SourceQuestion>;

export const Turn = z.object({ role: z.enum(['user', 'model']), text: z.string().min(1) });

/** A tutoring conversation about one question (Mongolian). */
export const Dialogue = z.object({
  questionId: z.string(),
  mode: z.enum(['hint', 'explain', 'desmos', 'similar', 'translate']),
  turns: z.array(Turn).min(2),
  reviewed: z.boolean().default(false),
});
export type Dialogue = z.infer<typeof Dialogue>;

/** One line of chat JSONL for small-model LoRA fine-tuning (Qwen / Unsloth, OpenAI-style messages). */
export const ChatExample = z.object({
  questionId: z.string(),
  mode: z.enum([
    'hint',
    'explain',
    'desmos',
    'translate',
    'mistake',
    'check',
    'wrong',
    'multi',
    'similar',
    'general',
    'feedback',
  ]),
  messages: z
    .array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string().min(1) }))
    .min(3),
});
export type ChatExample = z.infer<typeof ChatExample>;

/** One held-out prompt for base-vs-fine-tuned comparison. */
export const EvalItem = z.object({
  questionId: z.string(),
  /** original = held-out hand-written question; generated = held-out template question (same kinds as train). */
  source: z.enum(['original', 'generated']),
  mode: z.enum(['hint', 'explain', 'wrong']),
  prompt: z.string(),
  answer: z.string(),
  accepted: z.array(z.string()),
});
export type EvalItem = z.infer<typeof EvalItem>;

/** One line of Vertex AI supervised-tuning JSONL. */
export const TuningExample = z.object({
  systemInstruction: z.object({ role: z.literal('system'), parts: z.array(z.object({ text: z.string() })) }),
  contents: z
    .array(z.object({ role: z.enum(['user', 'model']), parts: z.array(z.object({ text: z.string() })) }))
    .min(2),
});
export type TuningExample = z.infer<typeof TuningExample>;

