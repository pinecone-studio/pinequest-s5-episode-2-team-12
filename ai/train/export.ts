// H4 · Questions → chat JSONL for a small-model LoRA fine-tune (Qwen2.5-1.5B-Instruct).
// Sources: our 32 hand-written questions + template-generated questions (ai/pipeline/generate.ts)
// + general conversations (ai/pipeline/general.ts). Every question becomes several tutor conversations.
// Splits never share a question. Run: `bun ai/train/export.ts`
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { QUESTIONS } from '../../src/mocks/questions';
import { withVerdict } from '../../src/server/ai/verdict';
import type { Question } from '../../src/types';
import { generalExamples } from '../pipeline/general';
import { generate, mulberry32, type Rng } from '../pipeline/generate';
import { type ChatExample, ChatExample as ChatExampleSchema, type EvalItem } from '../schema';

export const SYSTEM_PROMPT =
  'Чи бол "Суу" — монгол сурагчдад SAT Math заадаг эелдэг багш. Үргэлж монголоор, богино, ойлгомжтой хариул. ' +
  'Математикийг $…$ дотор бич. Сурагч зөвлөгөө (hint) асуувал эцсийн хариуг БҮҮ хэл — зөвхөн дараагийн алхмыг заа. ' +
  'Тайлбар асуувал алхам алхмаар бодоод, төгсгөлд "Хариу: …" гэж бич.';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function answerText(q: Question): string {
  if (Array.isArray(q.answer)) return q.answer[0] ?? '';
  const letter = LETTERS[q.answer] ?? '?';
  return `${letter}) ${q.choices?.[q.answer] ?? ''}`.trim();
}

export function questionBlock(q: Question): string {
  const lines = [q.prompt];
  if (q.choices) lines.push(...q.choices.map((c, i) => `${LETTERS[i]}) ${c}`));
  return lines.join('\n');
}

const ask = (q: Question, request: string) => `${questionBlock(q)}\n\n${request}`;
const pick = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;

// First item of each list is the "canonical" phrase the app sends (src/server/tutor/ollama.ts) and eval uses.
export const HINT_ASKS = [
  'Зөвлөгөө өгөөч, хариуг нь битгий хэлээрэй.',
  'Яаж эхлэхээ мэдэхгүй байна. Hint өгөх үү?',
  'Хариуг нь хэлэлгүйгээр жаахан туслаач.',
  'Энд гацчихлаа. Дараагийн алхам юу вэ?',
  'hint хэрэгтэй байна',
  'Эхний алхмыг л хэлээд өгөөч, үлдсэнийг өөрөө бодъё.',
] as const;
export const EXPLAIN_ASKS = [
  'Алхам алхмаар тайлбарлаж өгөөч.',
  'Энэ бодлогыг яаж бодох вэ? Бүрэн тайлбар хэрэгтэй.',
  'Бодолтыг нь бүтнээр нь харуулаач.',
  'Ойлгохгүй байна, эхнээс нь тайлбарлаач.',
  'Энийг бодоод өгөөч',
  'Хариу болон бодолтыг нь хэлээч.',
] as const;
const TRANSLATE_ASKS = [
  'Энэ асуултын англи үгсийг ойлгохгүй байна. Монголоор тайлбарлаач.',
  'Энэ асуулт юу асуугаад байна вэ? Англиар нь ойлгосонгүй.',
  'Монгол руу орчуулаад, юу хийх ёстойг хэлээч.',
] as const;
const SIMILAR_ASKS = [
  'Үүнтэй төстэй өөр нэг бодлого өгөөч.',
  'Ийм төрлийн дахиад нэг бодлого өгөөч, дасгал хийе.',
] as const;
const STILL_STUCK = [
  'Одоо ч ойлгохгүй байна. Бүтэн тайлбар өгөөч.',
  'Тэгээд дараа нь яах вэ? Бүтнээр нь харуулаач.',
] as const;
const PRAISE = ['Зөв! 🎉', 'Яг зөв! Сайн байна 👏', 'Зөв байна! 💪'] as const;
const NOT_YET = ['Харамсалтай нь буруу байна.', 'Яг биш байна.', 'Бараг л — гэхдээ буруу байна.'] as const;

function chat(questionId: string, mode: ChatExample['mode'], turns: string[]): ChatExample {
  return ChatExampleSchema.parse({
    questionId,
    mode,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...turns.map((content, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content })),
    ],
  });
}

const explainReply = (q: Question) => `${q.explain}\n\nХариу: ${answerText(q)}`;

/** A wrong answer a student might give, with the reason if we have one. */
function wrongAnswer(q: Question, r: Rng): { text: string; reason?: string } | null {
  if (q.choices && !Array.isArray(q.answer)) {
    const correct = q.answer;
    const wrong = q.choices.map((_, i) => i).filter((i) => i !== correct);
    const withWhy = wrong.filter((i) => q.why?.[i]);
    const i = withWhy.length ? pick(r, withWhy) : pick(r, wrong);
    return { text: `${LETTERS[i]}) ${q.choices[i]}`, reason: q.why?.[i] };
  }
  if (!Array.isArray(q.answer)) return null;
  const n = Number(q.answer[0]);
  if (!Number.isFinite(n)) return null;
  const off = pick(r, [1, -1, 2, 10] as const);
  return { text: String(n + off) };
}

export type ExampleOptions = {
  /** Questions of the same kind, used for "similar" requests. */
  siblings?: Question[];
  /** Hand-written questions get two phrasings per mode; generated ones get one. */
  rich?: boolean;
};

/** All tutor conversations for one question. */
export function examplesFor(q: Question, opts: ExampleOptions = {}, seed = hash(q.id)): ChatExample[] {
  const r = mulberry32(seed);
  const reps = opts.rich ? 2 : 1;
  const out: ChatExample[] = [];
  const phrases = <T>(xs: readonly T[]) => (reps === 2 ? xs.slice(0, 2) : [pick(r, xs)]);

  for (const a of phrases(HINT_ASKS)) out.push(chat(q.id, 'hint', [ask(q, a), q.hint]));
  for (const a of phrases(EXPLAIN_ASKS)) out.push(chat(q.id, 'explain', [ask(q, a), explainReply(q)]));

  // hint first, then the student is still stuck → full explanation
  out.push(chat(q.id, 'multi', [ask(q, pick(r, HINT_ASKS)), q.hint, pick(r, STILL_STUCK), explainReply(q)]));

  if (q.desmos) {
    const rows = q.desmos.rows.map((row) => `- \`${row}\``).join('\n');
    out.push(
      chat(q.id, 'desmos', [
        ask(q, 'Үүнийг Desmos ашиглаад яаж бодох вэ?'),
        `Desmos-д эдгээрийг бич:\n${rows}\n\n${q.desmos.tip}`,
      ]),
    );
  }

  if (q.mn || q.vocab?.length) {
    const parts: string[] = [];
    if (q.mn) parts.push(`Гол үг: ${q.mn}.`);
    if (q.vocab?.length) parts.push(`Анхаарах үгс: ${q.vocab.map((v) => `**${v}**`).join(', ')}.`);
    parts.push(`Юу хийх вэ гэвэл: ${q.hint}`);
    out.push(chat(q.id, 'translate', [ask(q, pick(r, TRANSLATE_ASKS)), parts.join(' ')]));
  }

  // student picked a wrong choice and asks why (one per question, or all for hand-written ones)
  if (q.why && q.choices) {
    const entries = Object.entries(q.why);
    for (const [idx, reason] of opts.rich ? entries : [pick(r, entries)]) {
      const i = Number(idx);
      out.push(
        chat(q.id, 'mistake', [
          withVerdict(ask(q, `Би ${LETTERS[i]}) ${q.choices[i]} гэж сонгосон. Яагаад буруу вэ?`), false),
          `${reason} Дахиад оролдоод үз: ${q.hint}`,
        ]),
      );
    }
  }

  // student gives a wrong answer — Suu must NOT say it's correct, and must not give the answer away
  const w = wrongAnswer(q, r);
  if (w) {
    out.push(
      chat(q.id, 'wrong', [
        withVerdict(ask(q, `Миний хариу: ${w.text}. Зөв үү?`), false),
        `${pick(r, NOT_YET)} ${w.reason ? `${w.reason} ` : ''}Зөвлөгөө: ${q.hint} Дахиад оролдоод үз!`,
      ]),
    );
  }

  out.push(
    chat(q.id, 'check', [
      withVerdict(ask(q, `Миний хариу: ${answerText(q)}. Зөв үү?`), true),
      `${pick(r, PRAISE)} ${q.explain}`,
    ]),
  );

  const sibs = (opts.siblings ?? []).filter((s) => s.id !== q.id);
  if (sibs.length) {
    const s = pick(r, sibs);
    out.push(
      chat(q.id, 'similar', [
        ask(q, pick(r, SIMILAR_ASKS)),
        `Ижил төрлийн бодлого (${s.skill}):\n\n${questionBlock(s)}\n\nӨөрөө бодоод, хариугаа надад хэлээрэй! Гацвал hint асуугаарай.`,
      ]),
    );
  }
  return out;
}

/** Stable small hash so each question gets the same phrasings every run. */
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Deterministic split of hand-written questions: every 6th question goes to val. */
export function split(questions: Question[]) {
  const val = questions.filter((_, i) => i % 6 === 5);
  const train = questions.filter((_, i) => i % 6 !== 5);
  return { train, val };
}

/** Template key of a generated question (`g-slope-s1-3` → `slope`), or the skill for hand-written ones. */
const kindOf = (q: Question) => (q.id.startsWith('g-') ? q.id.split('-s')[0] : q.skill);

/** All splits. Generated val/eval use other seeds and drop any prompt already in train. */
/**
 * Size knobs. 50 templates × 8 = 400 generated train questions (~3,000 examples) keeps a 2-epoch run on a free
 * Colab T4 around 25 minutes; eval uses every other template so base + fine-tuned eval stays ~20 minutes.
 */
export const SIZES = { perTemplate: 8, valPerTemplate: 1, evalEvery: 2 } as const;

export function buildSplits(perTemplate: number = SIZES.perTemplate) {
  const { train: origTrain, val: origVal } = split(QUESTIONS);
  const genTrain = generate(1, perTemplate);
  const seen = new Set([...QUESTIONS, ...genTrain].map((q) => q.prompt));
  const fresh = (qs: Question[]) => qs.filter((q) => !seen.has(q.prompt) && seen.add(q.prompt));
  const genVal = fresh(generate(2, SIZES.valPerTemplate));
  const genEval = fresh(generate(3, 1)).filter((_, i) => i % SIZES.evalEvery === 0);
  return { origTrain, origVal, genTrain, genVal, genEval };
}

function siblingsMap(qs: Question[]) {
  const m = new Map<string, Question[]>();
  for (const q of qs) m.set(kindOf(q), [...(m.get(kindOf(q)) ?? []), q]);
  return m;
}

export function buildDataset(perTemplate: number = SIZES.perTemplate) {
  const s = buildSplits(perTemplate);
  const trainSibs = siblingsMap([...s.origTrain, ...s.genTrain]);
  const valSibs = siblingsMap([...s.origVal, ...s.genVal]);
  const orig = new Map(QUESTIONS.map((q) => [q.id, q]));
  // hand-written questions point to their "similar" question by id
  const sibsFor = (q: Question, m: Map<string, Question[]>) => {
    const linked = q.similar ? orig.get(q.similar) : undefined;
    return linked ? [linked] : (m.get(kindOf(q)) ?? []);
  };
  const general = generalExamples(SYSTEM_PROMPT);
  const feedback = approvedFeedback();
  const generalVal = general.filter((_, i) => i % 10 === 9);
  const train = [
    ...s.origTrain.flatMap((q) => examplesFor(q, { rich: true, siblings: sibsFor(q, trainSibs) })),
    ...s.genTrain.flatMap((q) => examplesFor(q, { siblings: sibsFor(q, trainSibs) })),
    ...general.filter((_, i) => i % 10 !== 9),
    ...feedback,
  ];
  const val = [
    ...s.origVal.flatMap((q) => examplesFor(q, { rich: true, siblings: [] })),
    ...s.genVal.flatMap((q) => examplesFor(q, { siblings: valSibs.get(kindOf(q)) ?? [] })),
    ...generalVal,
  ];
  const evalSet = [...evalItems(s.origVal, 'original'), ...evalItems(s.genEval, 'generated')];
  return { train: shuffled(train), val, eval: evalSet, splits: s };
}

/** Human-approved user feedback (written by `bun ai/pipeline/feedback.ts export`). */
export function approvedFeedback(
  file = join(import.meta.dir, '..', 'data', 'tuning', 'feedback.jsonl'),
): ChatExample[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => ChatExampleSchema.parse(JSON.parse(l)));
}

function shuffled<T>(xs: T[]): T[] {
  const r = mulberry32(42);
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

export function evalItems(questions: Question[], source: EvalItem['source'] = 'original'): EvalItem[] {
  return questions.flatMap((q) => [
    {
      questionId: q.id,
      source,
      mode: 'explain' as const,
      prompt: ask(q, EXPLAIN_ASKS[0]),
      answer: answerText(q),
      accepted: accepted(q),
    },
    {
      questionId: q.id,
      source,
      mode: 'hint' as const,
      prompt: ask(q, HINT_ASKS[0]),
      answer: answerText(q),
      accepted: accepted(q),
    },
    ...wrongEval(q, source),
  ]);
}

/** Student gives a wrong answer: the model should not call it correct. */
function wrongEval(q: Question, source: EvalItem['source']): EvalItem[] {
  const w = wrongAnswer(q, mulberry32(hash(`${q.id}-eval`)));
  if (!w) return [];
  return [
    {
      questionId: q.id,
      source,
      mode: 'wrong',
      prompt: withVerdict(ask(q, `Миний хариу: ${w.text}. Зөв үү?`), false),
      answer: answerText(q),
      accepted: accepted(q),
    },
  ];
}

/** Strings that count as the correct final answer when checking model output. */
function accepted(q: Question): string[] {
  if (Array.isArray(q.answer)) return q.answer;
  const raw = (q.choices?.[q.answer] ?? '').replace(/\$/g, '');
  return [raw, `${LETTERS[q.answer]})`].filter(Boolean);
}

const toJsonl = (rows: unknown[]) => `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`;

if (import.meta.main) {
  const outDir = join(import.meta.dir, '..', 'data', 'tuning');
  mkdirSync(outDir, { recursive: true });
  const d = buildDataset();
  writeFileSync(join(outDir, 'train.jsonl'), toJsonl(d.train));
  writeFileSync(join(outDir, 'val.jsonl'), toJsonl(d.val));
  writeFileSync(join(outDir, 'eval.jsonl'), toJsonl(d.eval));
  const byMode = (rows: ChatExample[]) =>
    Object.entries(
      rows.reduce<Record<string, number>>((m, x) => {
        m[x.mode] = (m[x.mode] ?? 0) + 1;
        return m;
      }, {}),
    )
      .map(([k, v]) => `${k} ${v}`)
      .join(' · ');
  const s = d.splits;
  console.log(
    `questions: ${s.origTrain.length} hand-written + ${s.genTrain.length} generated (train) · ${s.origVal.length} + ${s.genVal.length} (val) · ${s.genEval.length} generated (eval)`,
  );
  console.log(`train: ${d.train.length} examples — ${byMode(d.train)}`);
  console.log(`val: ${d.val.length} · eval: ${d.eval.length} prompts → ai/data/tuning/`);
}
