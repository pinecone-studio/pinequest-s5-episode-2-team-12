// H2b · Template question generator for fine-tuning data.
// Each template (ai/pipeline/templates/*) picks random numbers (seeded, so output is reproducible), computes the
// answer in code, and writes Mongolian hint / step-by-step explanation / wrong-choice reasons. Math is never typed
// by hand, so it can't be wrong. Run: `bun ai/pipeline/generate.ts` (prints a sample).
import type { Question } from '../../src/types';
import { TEMPLATES } from './templates';
import type { Template } from './templates/shared';
import { mulberry32 } from './templates/shared';

export { KIT_TEMPLATES, TEMPLATES } from './templates';
export { frac, mulberry32, type Rng } from './templates/shared';

/** The plain final answer (choice text without $ for MCQ). */
export function finalAnswer(q: Pick<Question, 'answer' | 'choices'>): string {
  if (Array.isArray(q.answer)) return q.answer[0] ?? '';
  return (q.choices?.[q.answer] ?? '').replace(/\$/g, '');
}

/** True if `text` contains the final answer as a standalone value (2 does not match 12). */
export function mentionsAnswer(q: Pick<Question, 'answer' | 'choices'>, text: string): boolean {
  const a = finalAnswer(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return a !== '' && new RegExp(`(^|[^\\d.])${a}($|[^\\d])`).test(text);
}

/** True if the hint contains the final answer — even by coincidence. */
export function hintMentionsAnswer(q: Pick<Question, 'answer' | 'choices' | 'hint'>): boolean {
  return mentionsAnswer(q, q.hint);
}

/** n questions per template from one seed. Ids look like `g-slope-s1-3`. A template's questions depend only on
 *  its position in TEMPLATES, so passing a prefix of it (KIT_TEMPLATES) gives the same questions for those. */
export function generate(seed: number, perTemplate: number, templates: Template[] = TEMPLATES): Question[] {
  const out: Question[] = [];
  for (const [ti, t] of templates.entries()) {
    const r = mulberry32(seed * 1000 + ti);
    const seen = new Set<string>();
    let tries = 0;
    while (
      out.filter((q) => q.id.startsWith(`g-${t.key}-s${seed}-`)).length < perTemplate &&
      tries++ < perTemplate * 20
    ) {
      const d = t.make(r);
      if (!d || seen.has(d.prompt) || hintMentionsAnswer(d)) continue;
      seen.add(d.prompt);
      const n = seen.size;
      out.push({
        ...d,
        id: `g-${t.key}-s${seed}-${n}`,
        domain: t.domain,
        skill: t.skill,
        difficulty: d.difficulty ?? t.difficulty,
      });
    }
  }
  return out;
}

if (import.meta.main) {
  const qs = generate(1, 1);
  for (const q of qs.slice(0, 6)) console.log(JSON.stringify(q, null, 1), '\n');
  console.log(`${TEMPLATES.length} templates`);
}
