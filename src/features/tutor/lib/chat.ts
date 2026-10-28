// Section G · G4 · Chat logic for Suu, kept out of the component so it is easy to test.
import type { TutorContext, TutorMode } from '@/types';

export type ChatMsg = {
  id: string;
  role: 'user' | 'suu';
  text: string;
  /** What we sent to /api/tutor for this reply — needed for 👍/👎 feedback. */
  sent?: TutorRequest;
  demo?: boolean;
  /** Hand-written pitch answer (not live model output). */
  sample?: boolean;
  /** Desmos lesson to open from this reply (/desmos/ai?l=…). */
  lesson?: string;
  /** Which model wrote it: Suu (our fine-tune) or Gemini (free chat). */
  model?: 'suu' | 'gemini';
  status?: 'pending' | 'error';
};

/** What the Desmos side panel shows (visible steps only), so the chat can talk about the same graph. */
export type PanelView = {
  technique?: string;
  step: number;
  steps: { text: string; latex: string[] }[];
};

/** Extra state the chat sends with each question (all optional). */
export type ChatState = {
  /** Earlier messages of this chat. */
  messages?: ChatMsg[];
  /** The student answered or unlocked the answer. */
  revealed?: boolean;
  panel?: PanelView | null;
};

export type TutorRequest = {
  mode: TutorMode;
  message: string;
  raw: boolean;
  context?: { kind: TutorContext['kind']; id?: string };
  revealed?: boolean;
  history?: { role: 'user' | 'suu'; text: string }[];
  panel?: PanelView;
};

/** Quick actions shown when the chat is about a specific problem. Order = button order. */
export const QUICK_MODES: TutorMode[] = ['hint', 'explain', 'desmos', 'similar', 'translate'];

export type ChatAction = { kind: 'quick'; mode: TutorMode } | { kind: 'free'; text: string };

/** Turns a button press or typed text into an API request. Null when there is nothing to send. */
export function requestFor(
  action: ChatAction,
  ctx: TutorContext,
  state: ChatState = {},
): TutorRequest | null {
  const context = ctx.kind === 'general' ? undefined : { kind: ctx.kind, id: ctx.id };
  const extra = chatExtras(state, Boolean(ctx.chosen));
  if (action.kind === 'quick') {
    // Quick actions only make sense with a problem: send it exactly like the training data (problem + request phrase).
    if (!ctx.problem) return null;
    return { mode: action.mode, message: withChoice(ctx), raw: false, context, ...extra };
  }
  const text = action.text.trim();
  if (!text) return null;
  // the problem goes with every question: chat bubbles in the history only hold what the student typed
  const message = ctx.problem ? `${withChoice(ctx)}\n\n${text}` : text;
  return { mode: 'explain', message: message.slice(0, 2000), raw: true, context, ...extra };
}

/** History (finished messages, last 8, trimmed), the reveal flag and the panel view, without empty fields. */
export function chatExtras(
  state: ChatState,
  chosen: boolean,
): Pick<TutorRequest, 'revealed' | 'history' | 'panel'> {
  const history = (state.messages ?? [])
    .filter((m) => !m.status && m.text.trim())
    .slice(-8)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 1500) }));
  return {
    ...(state.revealed || chosen ? { revealed: true } : {}),
    ...(history.length ? { history } : {}),
    ...(state.panel?.steps.length ? { panel: state.panel } : {}),
  };
}

/** The problem text, plus the student's chosen answer when they came from a mistake. */
function withChoice(ctx: TutorContext): string {
  const p = ctx.problem ?? '';
  return ctx.chosen ? `${p}\n\nМиний хариу: ${ctx.chosen}` : p;
}

let counter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Label shown in the user's bubble for a quick action (the problem itself is already on screen). */
export function userBubbleText(action: ChatAction, label: (mode: TutorMode) => string): string {
  return action.kind === 'quick' ? label(action.mode) : action.text.trim();
}

export type ApiReply = {
  text: string;
  demo?: boolean;
  sample?: boolean;
  lesson?: string;
  model?: 'suu' | 'gemini';
};

/** Calls the tutor API. Throws on network or server errors so the caller can show a retry. */
export async function askSuu(req: TutorRequest, fetchImpl: typeof fetch = fetch): Promise<ApiReply> {
  const res = await fetchImpl('/api/tutor', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`tutor ${res.status}`);
  const data = (await res.json()) as Partial<ApiReply>;
  if (!data.text) throw new Error('tutor empty');
  return {
    text: data.text,
    demo: Boolean(data.demo),
    ...(data.model === 'suu' || data.model === 'gemini' ? { model: data.model } : {}),
    ...(data.sample ? { sample: true } : {}),
    ...(data.lesson ? { lesson: data.lesson } : {}),
  };
}

/** Replace one message by id (immutable update). */
export function patch(list: ChatMsg[], id: string, change: Partial<ChatMsg>): ChatMsg[] {
  return list.map((m) => (m.id === id ? { ...m, ...change } : m));
}
