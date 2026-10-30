// Server-only. The tutor's free chat on Gemini (AI Studio key), next to Suu (our fine-tuned model) which writes
// the Desmos lessons. Gemini never decides the facts on its own: the server looks the problem up in the question
// bank, grades the student's answer with code, and tells Gemini the verdict. The correct answer is sent only once
// the student may see it (they answered, unlocked it, or asked for the full explanation), so a hint can never
// leak it. Returns null instead of throwing, so the route can answer 503 (Суу cannot be reached).
import { roadmapQuestionById } from '@/features/roadmap/content/bank';
import { answersMatch } from '@/features/tutor/lib/desmos-lesson-parse';
import { questionById } from '@/server/bank';
import { serverEnv } from '@/server/env';
import type { Question, TutorMode } from '@/types';

const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const API = 'https://generativelanguage.googleapis.com/v1beta/models';

/** One earlier chat turn, as the browser sends it (already trimmed). */
export type ChatTurn = { role: 'user' | 'suu'; text: string };

/** What the Desmos side panel shows right now: only the steps the student can see (never the locked one). */
export type PanelView = {
  technique?: string;
  step: number;
  steps: { text: string; latex: string[] }[];
};

export type GeminiChatInput = {
  mode: TutorMode;
  /** The student's text (free chat) or the problem + request phrase (quick buttons). */
  message: string;
  raw: boolean;
  context?: { kind: string; id?: string };
  /** The student answered, or unlocked the answer in the Desmos panel. */
  revealed?: boolean;
  history?: ChatTurn[];
  panel?: PanelView;
};

export const GEMINI_SYSTEM = [
  'Чи бол "Суу" — монгол сурагчдад SAT Math заадаг эелдэг багш (энэ чатад Gemini загвар дээр ажиллаж байна).',
  'Үргэлж монголоор, богино, ойлгомжтой хариул. Математикийг $…$ дотор бич. Англи нэр томьёог хаалтанд өгч болно.',
  'Дүрэм:',
  '1. [Баримт] хэсэгт бичсэнийг үнэн гэж үз: бодлого, зөв хариу, сурагчийн хариуны шалгалт. Өөрөө өөр дүгнэлт хийхгүй.',
  '2. Шалгалт "БУРУУ" гэвэл хэзээ ч "зөв" гэж бүү хэл. "ЗӨВ" гэвэл магт, яагаад зөв болохыг товч тайлбарла.',
  '3. Зөв хариу [Баримт]-д байхгүй бол эцсийн хариуг БҮҮ хэл, бүү тааварла — зөвхөн дараагийн алхмыг заа.',
  '4. Сурагч зөвлөгөө (hint) асуувал эцсийн хариуг хэлэхгүй, нэг алхам л заана.',
  '5. Desmos самбар нээлттэй бол түүний алхам, мөрүүд рүү заан тайлбарла ("2-р алхмын $y=2x+1$ шулуун…").',
  '   Шинэ Desmos мөр санал болговол `y=2x+1` гэх мэт нэг мөрөөр бич.',
  '6. SAT Math-аас өөр сэдэв асуувал эелдгээр SAT Math руу буцаа.',
].join('\n');

function bankQuestion(context?: { kind: string; id?: string }): Question | undefined {
  if (!context?.id || (context.kind !== 'question' && context.kind !== 'mistake')) return undefined;
  return questionById(context.id) ?? roadmapQuestionById(context.id);
}

/** The correct answer as the student sees it ("B) $C=8n+25$" or "4"). */
export function answerText(q: Question): string {
  if (Array.isArray(q.answer)) return q.answer[0] ?? '';
  const choice = q.choices?.[q.answer];
  return choice === undefined ? '' : `${LETTERS[q.answer]}) ${choice}`;
}

const strip = (s: string) =>
  s
    .replace(/\\?\$/g, '')
    .replace(/\\(left|right)/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

/** Grades an answer attempt with code. null = we can't tell (then Gemini is told nothing about it). */
export function gradeAttempt(q: Question, attempt: string): boolean | null {
  const a = attempt.trim();
  if (!a) return null;
  if (Array.isArray(q.answer)) {
    if (!/\d/.test(a)) return null; // "гаа хэлээч" is not an attempt
    return q.answer.some((ok) => answersMatch(ok, a) || strip(ok) === strip(a));
  }
  if (!q.choices?.length) return null;
  const letter = a.match(/^\(?([A-Ea-e])\)?(?:[).:\s]|$)/)?.[1]?.toUpperCase();
  if (letter) return letter === LETTERS[q.answer];
  const correct = q.choices[q.answer] ?? '';
  if (strip(correct) === strip(a) || answersMatch(correct, a)) return true;
  const other = q.choices.some((c, i) => i !== q.answer && (strip(c) === strip(a) || answersMatch(c, a)));
  return other ? false : null;
}

/** An answer the student states in free text: "Миний хариу: B", "хариу 12", "x = 4", or just "B" / "4". */
export function statedAnswer(text: string): string | null {
  const t = text.trim();
  const m =
    t.match(
      /(?:миний\s+)?хариу(?![а-яёөү])(?:\s+(?:нь|бол))?\s*[:=-]?\s*([^\n?]+?)\s*(?:[.?!]|зөв\s*үү|$)/i,
    ) ??
    t.match(/(?:answer\s*(?:is)?|i\s+got)\s*[:=]?\s*([^\n?]+?)\s*(?:[.?!]|$)/i) ??
    t.match(/^\s*(?:[a-z]\s*=\s*)?(-?\d+(?:[.,/]\d+)?|\(?[A-Ea-e]\)?)\s*(?:зөв\s*үү)?\s*\??\s*$/i);
  return m?.[1]?.trim() || null;
}

/** The [Баримт] block the server puts in front of the student's message. */
export function factsFor(input: GeminiChatInput): string {
  const q = bankQuestion(input.context);
  const lines: string[] = [];
  if (q) {
    lines.push(`Бодлого (асуултын сангаас): ${q.prompt}`);
    if (q.choices?.length) lines.push(q.choices.map((c, i) => `${LETTERS[i]}) ${c}`).join('\n'));
    const showAnswer = input.revealed || input.mode === 'explain';
    if (showAnswer) lines.push(`Зөв хариу: ${answerText(q)}`);
    else lines.push('Зөв хариу: (сурагч хараахан хариулаагүй — хэлж болохгүй)');
    const attempt = chosenIn(input.message) ?? (input.raw ? statedAnswer(input.message) : null);
    const verdict = attempt ? gradeAttempt(q, attempt) : null;
    if (attempt && verdict !== null) {
      lines.push(`Сурагчийн хариу "${attempt}" — шалгалт (кодоор): ${verdict ? 'ЗӨВ' : 'БУРУУ'}`);
      if (verdict && !showAnswer) lines.push(`Зөв хариу: ${answerText(q)}`);
    }
  }
  if (input.panel?.steps.length) {
    lines.push(
      `Desmos самбар (Суу бичсэн хичээл${input.panel.technique ? `, арга: ${input.panel.technique}` : ''}), ` +
        `сурагч ${input.panel.step + 1}-р алхам дээр байна:`,
    );
    input.panel.steps.forEach((s, i) => {
      const rows = s.latex.length ? ` · Desmos: ${s.latex.map((l) => `\`${l}\``).join(', ')}` : '';
      lines.push(`${i + 1}. ${s.text}${rows}`);
    });
  }
  lines.push(`Горим: ${input.mode}${input.raw ? ' (сурагч өөрөө бичсэн)' : ' (товч дарсан)'}`);
  return `[Баримт]\n${lines.join('\n')}`;
}

/**
 * The code-graded verdict on the answer in this message (bank problem + "Миний хариу: X" or a stated answer).
 * null when there is no bank problem, no answer, or it can't be graded. Used for Gemini's facts and Suu's verdict line.
 */
export function verdictFor(input: Pick<GeminiChatInput, 'message' | 'raw' | 'context'>): boolean | null {
  const q = bankQuestion(input.context);
  if (!q) return null;
  const attempt = chosenIn(input.message) ?? (input.raw ? statedAnswer(input.message) : null);
  return attempt ? gradeAttempt(q, attempt) : null;
}

/** "Миний хариу: X" that the app itself adds when the student came from a mistake. */
function chosenIn(message: string): string | null {
  return message.match(/Миний хариу:\s*([^\n]+)/)?.[1]?.trim() ?? null;
}

type GeminiReply = { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };

/** True when the chat can use Gemini (an AI Studio key on the server). */
export function hasGeminiChat(): boolean {
  return Boolean(serverEnv().geminiApiKey);
}

export async function geminiTutorReply(
  input: GeminiChatInput,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const { geminiApiKey, geminiChatModel, geminiChatFallback } = serverEnv();
  if (!geminiApiKey) return null;
  const history = (input.history ?? []).slice(-8).map((t) => ({
    role: t.role === 'user' ? 'user' : 'model',
    parts: [{ text: t.text.slice(0, 1500) }],
  }));
  const body = {
    systemInstruction: { parts: [{ text: GEMINI_SYSTEM }] },
    contents: [
      ...history,
      { role: 'user', parts: [{ text: `${factsFor(input)}\n\n[Сурагч]\n${input.message}` }] },
    ],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  };
  // the main model first; when Google says it's overloaded or over the free quota (429/503), one try on the
  // lighter fallback model, so a demo doesn't fall back to a canned reply because of a busy minute
  const deadline = Date.now() + 25_000;
  for (const model of [geminiChatModel, geminiChatFallback].filter((m, i, a) => m && a.indexOf(m) === i)) {
    const left = deadline - Date.now();
    if (left < 3_000) return null;
    try {
      const res = await fetchImpl(`${API}/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiApiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(left),
      });
      if (res.status === 429 || res.status === 503) continue;
      if (!res.ok) return null;
      const data = (await res.json()) as GeminiReply;
      const text = (data.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought && p.text)
        .map((p) => p.text)
        .join('')
        .trim();
      return text || null;
    } catch {
      return null;
    }
  }
  return null;
}
