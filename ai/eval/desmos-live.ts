// Tests Suu the way the website really uses it: through Ollama, through the app's own code
// (modelDesmosLesson → parseModelLesson), on 48 held-out kit problems (3 per Desmos technique, never trained on).
// Run it on the computer that serves Suu (the iMac) while `ai/serve/start.sh` is running:
//
//   bun ai/eval/desmos-live.ts                 # all 48
//   bun ai/eval/desmos-live.ts --n 16          # first 16 (one per technique)
//   RAG_EXAMPLES=0 bun ai/eval/desmos-live.ts  # without RAG, to compare
//
// "shown" = the app would show the lesson (valid JSON, Desmos items, Mongolian, same final answer).
// Note: the app does not run the Desmos steps, so "shown" can be higher than the kit's strict lesson_pass.
import { modelDesmosLesson } from '../../src/server/ai/desmos-lesson';
import HOLDOUT from './desmos-holdout.json';

type Row = { technique: string; question: string; answer: string };

export type LiveResult = { technique: string; shown: boolean; ms: number; picked: string | null };

export function summary(results: LiveResult[]) {
  const n = results.length;
  const shown = results.filter((r) => r.shown);
  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (k: number) => (n ? Math.round((100 * k) / n) : 0);
  const per = new Map<string, { n: number; shown: number }>();
  for (const r of results) {
    const p = per.get(r.technique) ?? { n: 0, shown: 0 };
    p.n++;
    if (r.shown) p.shown++;
    per.set(r.technique, p);
  }
  return {
    n,
    shownPct: pct(shown.length),
    sameTechniquePct: pct(results.filter((r) => r.shown && r.picked === r.technique).length),
    p50Ms: ms[Math.floor((n - 1) / 2)] ?? 0,
    p95Ms: ms[Math.min(n - 1, Math.floor(n * 0.95))] ?? 0,
    perTechnique: Object.fromEntries([...per].map(([t, p]) => [t, `${p.shown}/${p.n}`])),
  };
}

if (import.meta.main) {
  process.env.OLLAMA_URL ||= 'http://127.0.0.1:11434';
  process.env.OLLAMA_SKILLS ||= 'desmos';
  const i = process.argv.indexOf('--n');
  const n = i > 0 ? Number(process.argv[i + 1]) : HOLDOUT.length;
  // --n 16 → one per technique first, then the rest
  const rows = [...(HOLDOUT as Row[])]
    .map((r, k) => ({ r, k: (k % 3) * 100 + Math.floor(k / 3) }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r)
    .slice(0, n);
  const results: LiveResult[] = [];
  for (const [k, row] of rows.entries()) {
    const t = Date.now();
    const res = await modelDesmosLesson(row.question, row.answer);
    const r = {
      technique: row.technique,
      shown: Boolean(res),
      ms: Date.now() - t,
      picked: res?.technique ?? null,
    };
    results.push(r);
    console.log(
      `${k + 1}/${rows.length} ${r.shown ? '✓' : '✗'} ${row.technique} ${(r.ms / 1000).toFixed(1)}s`,
    );
  }
  console.log(JSON.stringify({ rag: process.env.RAG_EXAMPLES ?? 'default', ...summary(results) }, null, 1));
}
