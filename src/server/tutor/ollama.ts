// Suu on a small fine-tuned model (Qwen2.5 + LoRA, see ai/train/suu_v2.ipynb) served by Ollama.
// Server-only. When OLLAMA_URL is empty or Ollama is down, the route falls back to demo replies.
// The HTTP call itself lives in src/server/ai/ollama-client.ts (shared with the Desmos lessons).

import { hasOllama, ollamaChat } from '@/server/ai/ollama-client';
import type { TutorMode } from '@/types';

/** Same system prompt the model was fine-tuned with (ai/train/export.ts). Keep them in sync. */
export const SUU_SYSTEM_PROMPT =
  'Чи бол "Суу" — монгол сурагчдад SAT Math заадаг эелдэг багш. Үргэлж монголоор, богино, ойлгомжтой хариул. ' +
  'Математикийг $…$ дотор бич. Сурагч зөвлөгөө (hint) асуувал эцсийн хариуг БҮҮ хэл — зөвхөн дараагийн алхмыг заа. ' +
  'Тайлбар асуувал алхам алхмаар бодоод, төгсгөлд "Хариу: …" гэж бич.';

/** Phrases match the training data, so the model sees familiar requests. */
const MODE_ASK: Record<TutorMode, string> = {
  hint: 'Зөвлөгөө өгөөч, хариуг нь битгий хэлээрэй.',
  explain: 'Алхам алхмаар тайлбарлаж өгөөч.',
  desmos: 'Үүнийг Desmos ашиглаад яаж бодох вэ?',
  similar: 'Үүнтэй төстэй өөр нэг бодлого өгөөч.',
  translate: 'Энэ асуултын англи үгсийг ойлгохгүй байна. Монголоор тайлбарлаач.',
};

/** What the model sees. Quick-action buttons add the trained request phrase; free chat (`raw`) sends the text as is. */
export function buildUserMessage(mode: TutorMode, message: string, raw = false): string {
  return raw ? message.trim() : `${message.trim()}\n\n${MODE_ASK[mode]}`;
}

/** True when OLLAMA_URL is set (the tutor and the Desmos lessons then try the model first). */
export { hasOllama } from '@/server/ai/ollama-client';

/** Returns the model's reply, or null if Ollama is not configured / the chat skill is off / down / too slow. */
export async function ollamaReply(
  mode: TutorMode,
  message: string,
  fetchImpl: typeof fetch = fetch,
  raw = false,
): Promise<string | null> {
  if (!hasOllama('chat')) return null;
  return ollamaChat(
    [
      { role: 'system', content: SUU_SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(mode, message, raw) },
    ],
    { temperature: 0.3, maxTokens: 400 },
    fetchImpl,
  );
}
