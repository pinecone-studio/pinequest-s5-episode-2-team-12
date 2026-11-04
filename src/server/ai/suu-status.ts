// Server-only. Is Suu (our fine-tuned model) reachable right now, and which AI parts are on? (GET /api/suu/status)
// No secrets leave here: no URLs, tokens or keys, only yes/no.
import { hasOllama, ollamaHeaders } from '@/server/ai/ollama-client';
import { serverEnv } from '@/server/env';

const SKILLS = ['chat', 'desmos', 'planner', 'analyze'] as const;

export type SuuStatus = {
  /** OLLAMA_URL is set on the server. */
  configured: boolean;
  /** Suu answered /api/version within 4 seconds. */
  online: boolean;
  /** Round trip in ms when online. */
  latencyMs?: number;
  /** Skills the website will ask Suu for (OLLAMA_SKILLS). */
  skills: (typeof SKILLS)[number][];
  /** The tutor's free chat can use Gemini (GEMINI_API_KEY is set). */
  geminiChat: boolean;
};

export async function suuStatus(fetchImpl: typeof fetch = fetch): Promise<SuuStatus> {
  const env = serverEnv();
  const skills = SKILLS.filter((s) => hasOllama(s));
  const base: SuuStatus = {
    configured: Boolean(env.ollamaUrl),
    online: false,
    skills,
    geminiChat: Boolean(env.geminiApiKey),
  };
  if (!env.ollamaUrl) return base;
  const t = Date.now();
  try {
    const res = await fetchImpl(`${env.ollamaUrl.replace(/\/$/, '')}/api/version`, {
      headers: ollamaHeaders(env.ollamaToken),
      signal: AbortSignal.timeout(4_000),
    });
    return res.ok ? { ...base, online: true, latencyMs: Date.now() - t } : base;
  } catch {
    return base;
  }
}
