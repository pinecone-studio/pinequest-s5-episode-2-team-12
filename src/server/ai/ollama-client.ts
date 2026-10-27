// Server-only. The one place that talks to Suu (the fine-tuned model) on Ollama.
// Every skill (chat, Desmos lessons, later planner/analyze) picks its behaviour with the system prompt.
// Returns null instead of throwing, so each caller can fall back to its sample/demo content.
import { serverEnv } from '@/server/env';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type OllamaOptions = {
  /** Ask Ollama for strict JSON output (Desmos lessons, planner, analysis). */
  json?: boolean;
  /** Max new tokens (Ollama `num_predict`). */
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

type OllamaChat = { message?: { content?: string } };

/** What Suu can be asked to do. A model version may know only some of them (Suu v1 learned only 'desmos'). */
export type SuuSkill = 'chat' | 'desmos' | 'planner' | 'analyze';

/**
 * True when OLLAMA_URL is set and, if a skill is given, OLLAMA_SKILLS allows it (empty OLLAMA_SKILLS = all).
 * A skill that is off falls back to the demo/sample content instead of asking a model that never learned it.
 */
export function hasOllama(skill?: SuuSkill): boolean {
  const { ollamaUrl, ollamaSkills } = serverEnv();
  if (!ollamaUrl) return false;
  if (!skill) return true;
  const on = ollamaSkills
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return on.length === 0 || on.includes(skill);
}

/** Headers for Ollama. With OLLAMA_TOKEN set (tunnel + ai/serve/proxy.ts) it adds the bearer token. */
export function ollamaHeaders(token: string): Record<string, string> {
  return token
    ? { 'content-type': 'application/json', authorization: `Bearer ${token}` }
    : { 'content-type': 'application/json' };
}

/** Sends a chat to Ollama and returns the reply text, or null if not configured / down / too slow / empty. */
export async function ollamaChat(
  messages: ChatMessage[],
  opts: OllamaOptions = {},
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const { ollamaUrl, ollamaModel, ollamaToken } = serverEnv();
  if (!ollamaUrl) return null;
  try {
    const res = await fetchImpl(`${ollamaUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: ollamaHeaders(ollamaToken),
      body: JSON.stringify({
        model: ollamaModel,
        stream: false,
        ...(opts.json ? { format: 'json' } : {}),
        options: { temperature: opts.temperature ?? 0.3, num_predict: opts.maxTokens ?? 400 },
        messages,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OllamaChat;
    const text = data.message?.content?.trim();
    return text ? text : null;
  } catch {
    return null;
  }
}
