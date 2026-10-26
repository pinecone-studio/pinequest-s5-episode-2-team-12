// Server-only. System prompts of Suu's skills. Each must be the exact text the model was fine-tuned with,
// otherwise the model behaves like the untrained base model. Tests compare them with ai/v2/skills.ts.
export { SUU_SYSTEM_PROMPT as CHAT_PROMPT } from '@/server/tutor/ollama';

/** Desmos lessons (training kit sat_desmos_kit; same text as ai/v2/skills.ts DESMOS_PROMPT). */
export const DESMOS_PROMPT =
  'Чи SAT Math-ийн багш. Desmos-оор заах нь чиний гол арга. Асуулт болон зөв хариуг өгөхөд хамгийн тохирох ' +
  'Desmos аргыг сонгож, алхам бүрт Desmos-д юу хийхийг энгийн монголоор тайлбарла. Зөвхөн JSON буцаа: ' +
  '{"technique":...,"steps":[{"text":...,"desmos":[...],"bounds":{...}}],"check":...,"answer":...}';

/** User message format of the Desmos training data. */
export function desmosUserMessage(question: string, answer: string): string {
  return `Асуулт: ${question.trim()}\nЗөв хариу: ${answer.trim()}`;
}

/** The phrase the chat skill was trained on for a full step-by-step solution (ends with "Хариу: …"). */
export const EXPLAIN_ASK = 'Алхам алхмаар тайлбарлаж өгөөч.';
