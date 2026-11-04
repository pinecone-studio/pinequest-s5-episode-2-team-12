// Asks the website for the Desmos lessons of the demo problems once, before the demo, so Suu's answers are
// already remembered by the gate on the iMac (ai/serve/proxy.ts cache) and appear at once when clicked.
// Uses the exact request the cat «Desmos» button sends (panelInput), so the cached answer is the one reused.
//
//   bun ai/serve/warm.ts https://our-site.example            # every bank problem that has Desmos rows
//   bun ai/serve/warm.ts https://our-site.example a1 v2 g2   # only these problem ids
import { panelInput } from '../../src/features/tutor/lib/desmos-panel';
import { QUESTIONS } from '../../src/mocks/questions';
import type { Question } from '../../src/types';

export function demoQuestions(ids: string[] = []): Question[] {
  if (ids.length)
    return ids.map((id) => QUESTIONS.find((q) => q.id === id)).filter((q): q is Question => Boolean(q));
  return QUESTIONS.filter((q) => q.desmos?.rows.length);
}

type Lesson = { source?: string; lesson?: unknown };

export async function warm(site: string, qs: Question[], fetchImpl: typeof fetch = fetch, log = console.log) {
  const out: { id: string; source: string; ms: number }[] = [];
  for (const q of qs) {
    const input = panelInput(q);
    const t = Date.now();
    let source = 'error';
    try {
      const res = await fetchImpl(`${site.replace(/\/$/, '')}/api/desmos/lesson`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          input.answer ? { question: input.question, answer: input.answer } : { question: input.question },
        ),
        signal: AbortSignal.timeout(70_000),
      });
      source = res.ok ? (((await res.json()) as Lesson).source ?? 'none') : `http ${res.status}`;
    } catch {}
    out.push({ id: q.id, source, ms: Date.now() - t });
    log(`${source === 'model' ? '✓' : '·'} ${q.id} ${source} ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
  return out;
}

if (import.meta.main) {
  const [site, ...ids] = process.argv.slice(2);
  if (!site) throw new Error('usage: bun ai/serve/warm.ts <website url> [question ids…]');
  const res = await warm(site, demoQuestions(ids));
  const live = res.filter((r) => r.source === 'model').length;
  console.log(
    `${live}/${res.length} lessons written by Suu and remembered; the rest show a sample or nothing.`,
  );
}
