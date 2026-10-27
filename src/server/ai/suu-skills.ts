// Server-only. Суу's planner and analyze skills, used by /api/suu/planner and /api/suu/analyze.
// Суу gets the exact training prompt and input format (ai/v2). Its JSON is shown only when it passes the same
// checks the kit scores the model with (scorePlan / scoreAnalysis); otherwise — or with the model off — the
// page gets the rule engine's answer, which is how the kit's gold answers are made. `source` says which.
import { type AnalyzeInput, type AnalyzeOutput, analyze, scoreAnalysis } from '../../../ai/v2/analyze';
import { parseNote } from '../../../ai/v2/note';
import { type PlannerInput, type PlannerOutput, parseJson, plan, scorePlan } from '../../../ai/v2/planner';
import { ANALYZE_PROMPT, PLANNER_PROMPT } from '../../../ai/v2/skills';
import { hasOllama, ollamaChat } from './ollama-client';

export type SkillSource = 'model' | 'rules';
export type SkillResult<T> = { result: T; source: SkillSource };

/** A laptop model writes a week plan in ~20–45 s; the routes allow 60 s. */
const MODEL_TIMEOUT_MS = 50_000;

const str = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');

/** The checked model plan with only the fields the page draws (scorePlan already checked the shape). */
function cleanPlan(o: PlannerOutput): PlannerOutput {
  return {
    phase: o.phase,
    focus: o.focus.slice(0, 5).map((f) => ({ id: Number(f.id), why: str(f.why, 200) })),
    check: Array.isArray(o.check) ? o.check.map(Number).filter(Number.isInteger).slice(0, 26) : [],
    week: o.week.map((d) => ({
      day: d.day,
      min: d.min,
      tasks: d.tasks.slice(0, 6).map((t) => ({
        t: t.t,
        min: t.min,
        ...(typeof t.topic === 'number' ? { topic: t.topic } : {}),
        ...(t.timed ? { timed: true as const } : {}),
      })),
    })),
    advice: str(o.advice, 900),
  };
}

function cleanAnalysis(o: AnalyzeOutput): AnalyzeOutput {
  return {
    patterns: o.patterns.slice(0, 12).map((p) => ({
      type: p.type,
      count: Number(p.count),
      ...(typeof p.topic === 'number' ? { topic: p.topic } : {}),
      ...(typeof p.word === 'string' ? { word: str(p.word, 40) } : {}),
    })),
    habits: { rushed: o.habits.rushed, slow: o.habits.slow, desmos: o.habits.desmos },
    summary: str(o.summary, 600),
    next: Array.isArray(o.next)
      ? o.next
          .map((x) => str(x, 200))
          .filter(Boolean)
          .slice(0, 5)
      : [],
  };
}

/** A 7-day plan from Суу (checked) or from the rules. */
export async function suuPlan(
  input: PlannerInput,
  fetchImpl: typeof fetch = fetch,
): Promise<SkillResult<PlannerOutput>> {
  const rules = parseNote(input.note);
  if (hasOllama('planner')) {
    const text = await ollamaChat(
      [
        { role: 'system', content: PLANNER_PROMPT },
        { role: 'user', content: JSON.stringify(input) },
      ],
      { json: true, temperature: 0, maxTokens: 1400, timeoutMs: MODEL_TIMEOUT_MS },
      fetchImpl,
    );
    if (text && scorePlan(text, input, rules).pass) {
      return { result: cleanPlan(parseJson(text) as PlannerOutput), source: 'model' };
    }
  }
  return { result: plan(input, rules), source: 'rules' };
}

/** Mistake patterns from Суу (checked) or from the rules. */
export async function suuAnalyze(
  input: AnalyzeInput,
  fetchImpl: typeof fetch = fetch,
): Promise<SkillResult<AnalyzeOutput>> {
  if (hasOllama('analyze')) {
    const text = await ollamaChat(
      [
        { role: 'system', content: ANALYZE_PROMPT },
        { role: 'user', content: JSON.stringify(input) },
      ],
      { json: true, temperature: 0, maxTokens: 900, timeoutMs: MODEL_TIMEOUT_MS },
      fetchImpl,
    );
    if (text && scoreAnalysis(text, input).pass) {
      return { result: cleanAnalysis(parseJson(text) as AnalyzeOutput), source: 'model' };
    }
  }
  return { result: analyze(input), source: 'rules' };
}
