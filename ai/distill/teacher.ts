// Verified distillation · step 2. A big teacher model (Gemini, AI Studio key) answers each prompt k times.
// Nothing here is trusted: verify.ts keeps only replies that pass the same checks the website runs.
// Resumable — prompts that already have k candidates in the output file are skipped.
//
//   GEMINI_API_KEY=… bun ai/distill/teacher.ts --k 3 --limit 400
//   → ai/out/distill/candidates.jsonl   ({ id, sample, text } per line)
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { arg, type DistillPrompt, type Msg, writeJsonl } from './prompts';

export type Candidate = { id: string; sample: number; text: string };

const API = 'https://generativelanguage.googleapis.com/v1beta/models';

type GeminiReply = { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };

/** Gemini request body for our chat messages (system → systemInstruction, assistant → model). */
export function geminiBody(messages: Msg[], temperature: number, json: boolean) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content);
  return {
    ...(system.length ? { systemInstruction: { parts: [{ text: system.join('\n\n') }] } } : {}),
    contents: messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: {
      temperature,
      maxOutputTokens: 2048,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
  };
}

export type TeacherOpts = { apiKey: string; model: string; fetchImpl?: typeof fetch; retries?: number };

/** One teacher reply, or null after `retries` tries (429/503 back off and retry; other errors give up). */
export async function askTeacher(
  p: Pick<DistillPrompt, 'messages' | 'skill'>,
  temperature: number,
  { apiKey, model, fetchImpl = fetch, retries = 4 }: TeacherOpts,
): Promise<string | null> {
  const body = JSON.stringify(geminiBody(p.messages, temperature, p.skill === 'desmos'));
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetchImpl(`${API}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status === 429 || res.status === 503) {
        await new Promise((r) => setTimeout(r, Math.min(30_000, 2_000 * 2 ** attempt)));
        continue;
      }
      if (!res.ok) return null;
      const data = (await res.json()) as GeminiReply;
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .filter((x) => !x.thought && x.text)
        .map((x) => x.text)
        .join('')
        .trim();
      return text || null;
    } catch {
      // timeout or network: try again
    }
  }
  return null;
}

/** Sample temperatures: the first reply greedy, the rest varied so a wrong first try can be beaten. */
export const temperatureFor = (sample: number) => (sample === 0 ? 0 : 0.7);

export function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

/** Asks for every missing (prompt, sample) pair, `concurrency` at a time, appending as it goes. */
export async function runTeacher(
  prompts: DistillPrompt[],
  k: number,
  outPath: string,
  opts: TeacherOpts & { concurrency?: number; log?: (s: string) => void },
): Promise<{ asked: number; got: number }> {
  const have = new Set(readJsonl<Candidate>(outPath).map((c) => `${c.id}#${c.sample}`));
  const jobs = prompts.flatMap((p) =>
    Array.from({ length: k }, (_, sample) => ({ p, sample })).filter(
      ({ sample }) => !have.has(`${p.id}#${sample}`),
    ),
  );
  let got = 0;
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      if (!job) break;
      const text = await askTeacher(job.p, temperatureFor(job.sample), opts);
      if (text === null) continue;
      appendFileSync(
        outPath,
        `${JSON.stringify({ id: job.p.id, sample: job.sample, text } satisfies Candidate)}\n`,
      );
      got++;
      if (got % 25 === 0) opts.log?.(`${got}/${jobs.length}`);
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker));
  return { asked: jobs.length, got };
}

if (import.meta.main) {
  const apiKey = process.env.GEMINI_API_KEY ?? '';
  if (!apiKey) {
    console.error(
      'GEMINI_API_KEY алга. AI Studio-оос түлхүүр аваад: GEMINI_API_KEY=… bun ai/distill/teacher.ts',
    );
    process.exit(1);
  }
  const prompts = readJsonl<DistillPrompt>(arg('prompts', 'ai/out/distill/prompts.jsonl'));
  const limit = Number(arg('limit', String(prompts.length)));
  const out = arg('out', 'ai/out/distill/candidates.jsonl');
  if (!existsSync(out)) writeJsonl(out, []);
  const r = await runTeacher(prompts.slice(0, limit), Number(arg('k', '3')), out, {
    apiKey,
    model: arg('model', process.env.GEMINI_TEACHER_MODEL ?? 'gemini-flash-latest'),
    concurrency: Number(arg('concurrency', '4')),
    log: console.log,
  });
  console.log(`асуусан ${r.asked}, ирсэн ${r.got} → ${out}`);
}
