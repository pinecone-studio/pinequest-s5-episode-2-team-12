'use client';
// Section G · G4 · Chat with Suu. Left: new chat + recent chats (kept in this browser). Centre: the cat,
// suggested prompts, then the conversation. Quick actions (hint, explain, Desmos, similar, translate) appear
// for a problem; free chat for anything else. Math renders with KaTeX; every real (non-demo) reply gets 👍/👎.
import Link from 'next/link';
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Rich } from '@/components/math';
import { Icon } from '@/components/shell/icons';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import type { TutorContext, TutorMode } from '@/types';
import { useElapsed, waitLabel } from '../hooks/useElapsed';
import {
  askSuu,
  type ChatAction,
  type ChatMsg,
  newId,
  type PanelView,
  patch,
  QUICK_MODES,
  requestFor,
  userBubbleText,
} from '../lib/chat';
import { DesmosCatButton, DesmosSidePanel } from './DesmosSidePanel';
import { FeedbackButtons } from './FeedbackButtons';

type Props = {
  context: TutorContext;
  /** Suggested prompts for an empty chat. `**bold**` marks the emphasised words. */
  starters?: string[];
  fetchImpl?: typeof fetch;
};

type Session = { id: string; title: string; context: TutorContext; messages: ChatMsg[]; at: number };

const STORE = 'suprep-tutor-chats';
const MAX_SESSIONS = 30;
const GENERAL: TutorContext = { kind: 'general', title: 'SAT Math' };

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Session[]) : [];
  } catch {
    return [];
  }
}

function saveSessions(list: Session[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(list.slice(0, MAX_SESSIONS)));
  } catch {
    // storage full or blocked: history lasts for this visit only
  }
}

const plain = (s: string) => s.replaceAll('**', '');

/** "Quiz me **on…**" → alternating normal / bold spans. */
function Starter({ text }: { text: string }) {
  const parts = text.split('**');
  return (
    <span>
      {parts.map((p, i) =>
        i % 2 ? (
          <strong key={i} className="font-semibold text-ink">
            {p}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

function SuuAvatar({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('grid place-items-center shrink-0 overflow-hidden rounded-[30%] bg-sage', className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* biome-ignore lint/performance/noImgElement: static transparent image */}
      <img
        src="/brand/suu-logo-head.webp"
        alt=""
        width={size}
        height={size}
        className="w-[88%] h-auto translate-y-[6%]"
      />
    </span>
  );
}

export function TutorChat({ context, starters = [], fetchImpl = fetch }: Props) {
  const t = useT('tutor');
  const [ctx, setCtx] = useState<TutorContext>(context);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // the cat «Desmos» side panel for a bank problem; its last step unlocks once the student has answered
  const [desmosOpen, setDesmosOpen] = useState(false);
  const [desmosRevealed, setDesmosRevealed] = useState(false);
  // what the Desmos panel shows right now, so the chat (Gemini) talks about the same graph
  const [panel, setPanel] = useState<PanelView | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const busy = messages.some((m) => m.status === 'pending');

  useEffect(() => setSessions(loadSessions()), []);

  useEffect(() => {
    // scroll to the newest message (happy-dom in tests may not implement scrollIntoView)
    if (messages.length === 0) return;
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  // keep the active chat in history (finished messages only, so a reload never shows a stuck spinner)
  useEffect(() => {
    if (!activeId) return;
    const done = messages.filter((m) => !m.status);
    if (!done.length) return;
    setSessions((list) => {
      const prev = list.find((s) => s.id === activeId);
      const firstUser = done.find((m) => m.role === 'user')?.text ?? ctx.title;
      const title = ctx.problem ? `${ctx.title}: ${firstUser}` : firstUser;
      const next: Session = {
        id: activeId,
        title: prev?.title ?? title.slice(0, 80),
        context: ctx,
        messages: done,
        at: Date.now(),
      };
      const updated = [next, ...list.filter((s) => s.id !== activeId)];
      saveSessions(updated);
      return updated;
    });
  }, [messages, activeId, ctx]);

  async function run(action: ChatAction, retryOf?: string) {
    // a retry sends the same history as the first try: only the messages before the question being retried
    const at = retryOf ? messages.findIndex((m) => m.id === retryOf) : -1;
    const before = at > 0 ? messages.slice(0, at - 1) : messages;
    const req = requestFor(action, ctx, {
      messages: before,
      revealed: desmosRevealed,
      panel: desmosOpen ? panel : null,
    });
    if (!req || busy) return;
    if (!activeId) setActiveId(newId('chat'));
    const replyId = retryOf ?? newId('suu');
    if (retryOf) {
      setMessages((list) => patch(list, retryOf, { status: 'pending', text: '' }));
    } else {
      const label = (m: TutorMode) => t(`modes.${m}`);
      setMessages((list) => [
        ...list,
        { id: newId('me'), role: 'user', text: userBubbleText(action, label) },
        { id: replyId, role: 'suu', text: '', status: 'pending', sent: req },
      ]);
      setDraft('');
    }
    try {
      const reply = await askSuu(req, fetchImpl);
      setMessages((list) =>
        patch(list, replyId, {
          text: reply.text,
          demo: reply.demo,
          sample: reply.sample,
          lesson: reply.lesson,
          model: reply.model,
          status: undefined,
        }),
      );
    } catch {
      setMessages((list) => patch(list, replyId, { status: 'error' }));
    }
  }

  function retry(msg: ChatMsg) {
    const userBefore = messages[messages.findIndex((m) => m.id === msg.id) - 1];
    if (!msg.sent || !userBefore) return;
    const action: ChatAction = msg.sent.raw
      ? { kind: 'free', text: userBefore.text }
      : { kind: 'quick', mode: msg.sent.mode };
    void run(action, msg.id);
  }

  function newChat() {
    if (busy) return;
    setActiveId(null);
    setMessages([]);
    setCtx(ctx.problem ? GENERAL : ctx);
    setDraft('');
    setDesmosOpen(false);
    setDesmosRevealed(false);
  }

  function openChat(s: Session) {
    if (busy) return;
    setActiveId(s.id);
    setCtx(s.context);
    setMessages(s.messages);
    setDesmosOpen(false);
    setDesmosRevealed(false);
  }

  function deleteChat(id: string) {
    setSessions((list) => {
      const updated = list.filter((s) => s.id !== id);
      saveSessions(updated);
      return updated;
    });
    if (id === activeId) {
      setActiveId(null);
      setMessages([]);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void run({ kind: 'free', text: draft });
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void run({ kind: 'free', text: draft });
    }
  }

  const empty = messages.length === 0;
  const desmos = desmosOpen && ctx.desmos ? ctx.desmos : null;

  return (
    <div
      className={cn(
        'soft-card mx-auto w-full overflow-hidden border border-line md:grid md:grid-cols-[250px_minmax(0,1fr)] md:h-[calc(100dvh-124px)] min-h-[calc(100dvh-180px)]',
        // Desmos open: the screen splits in half (chat | Desmos); the chat history steps aside
        desmos ? 'max-w-[1280px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]' : 'max-w-6xl',
      )}
    >
      {/* recent chats */}
      <aside
        className={cn(
          'hidden md:flex flex-col gap-3 border-r border-line bg-paper-2/60 p-3 min-h-0',
          desmos && 'lg:hidden',
        )}
      >
        <button
          type="button"
          onClick={newChat}
          className="flex items-center justify-center gap-2 h-11 rounded-2xl bg-lime text-[var(--c-on-lime)] font-bold text-[15px] shadow-[0_10px_20px_-12px_var(--c-leaf)] hover:brightness-105"
        >
          <span className="text-[20px] leading-none">+</span>
          {t('chat.newChat')}
        </button>
        <div className="px-2 pt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
          {t('chat.history')}
        </div>
        <ul className="grid gap-0.5 overflow-y-auto scroll-thin min-h-0 content-start">
          {sessions.length === 0 && (
            <li className="px-2 py-1 text-[13.5px] text-ink-3">{t('chat.noHistory')}</li>
          )}
          {sessions.map((s) => (
            <li key={s.id} className="group relative">
              <button
                type="button"
                onClick={() => openChat(s)}
                className={cn(
                  'w-full text-left truncate rounded-xl px-3 py-2.5 pr-8 text-[14px] transition-colors',
                  s.id === activeId ? 'bg-sage text-leaf-2 font-semibold' : 'text-ink-2 hover:bg-paper',
                )}
              >
                {s.title}
              </button>
              <button
                type="button"
                onClick={() => deleteChat(s.id)}
                aria-label={t('chat.deleteChat')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 size-6 rounded-lg text-ink-3 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-paper-2 hover:text-danger"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* conversation */}
      <div className="flex flex-col min-h-0 min-w-0">
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h1 className="font-bold text-ink">{t('pages.tutor.title')}</h1>
          <button
            type="button"
            onClick={newChat}
            className="md:hidden h-9 px-3 rounded-xl bg-sage text-leaf-2 text-[14px] font-bold"
          >
            + {t('chat.newChat')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto scroll-thin px-4 md:px-8 py-6 min-h-0">
          <div className="mx-auto w-full max-w-3xl grid gap-4">
            {ctx.problem && (
              <section aria-label={t('chat.problem')} className="rounded-2xl border border-line bg-paper p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Pill tone="leaf">{ctx.title}</Pill>
                  {ctx.chosen && <Pill tone="rose">{t('chat.yourAnswer', { answer: ctx.chosen })}</Pill>}
                </div>
                <Rich text={ctx.problem} className="text-[15px] leading-relaxed text-ink" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_MODES.map((m) => (
                    <Button
                      key={m}
                      size="sm"
                      variant="soft"
                      disabled={busy}
                      onClick={() => void run({ kind: 'quick', mode: m })}
                    >
                      {t(`modes.${m}`)}
                    </Button>
                  ))}
                  {ctx.desmos && (
                    <DesmosCatButton
                      open={desmosOpen}
                      onClick={() => setDesmosOpen((o) => !o)}
                      className="!py-1 !rounded-xl"
                    />
                  )}
                </div>
              </section>
            )}

            {empty && !ctx.problem && (
              <div className="grid justify-items-center text-center pt-6 md:pt-14 pb-4">
                <SuuAvatar size={112} className="shadow-[0_18px_36px_-18px_rgba(12,40,22,.45)]" />
                <h2 className="mt-6 text-[19px] md:text-[21px] text-ink-2">{t('chat.hero')}</h2>
              </div>
            )}

            <ol aria-live="polite" className="grid gap-4">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className={m.role === 'user' ? 'flex justify-end' : 'flex items-start gap-2.5'}
                >
                  {m.role === 'user' ? (
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-forest px-4 py-2.5 text-[15px] text-cream">
                      <Rich text={m.text} />
                    </div>
                  ) : (
                    <>
                      <SuuAvatar size={34} className="mt-0.5" />
                      <SuuBubble msg={m} onRetry={() => retry(m)} />
                    </>
                  )}
                </li>
              ))}
            </ol>
            <div ref={endRef} />
          </div>
        </div>

        <div className="px-4 md:px-8 pb-4 md:pb-6 sticky bottom-20 md:static">
          <div className="mx-auto w-full max-w-3xl">
            {empty && !ctx.problem && starters.length > 0 && (
              <ul className="mb-4 grid">
                {starters.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => void run({ kind: 'free', text: plain(s) })}
                      className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-[15px] text-ink-3 hover:bg-paper-2 transition-colors"
                    >
                      <Starter text={s} />
                      <Icon name="chevron" size={17} className="text-ink-3 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={onSubmit}
              className="rounded-[24px] bg-paper-2 border border-line p-3 pl-4 focus-within:border-leaf transition-colors"
            >
              <label htmlFor={inputId} className="sr-only">
                {t('chat.inputLabel')}
              </label>
              <textarea
                id={inputId}
                rows={1}
                maxLength={1500}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                placeholder={t('chat.placeholder')}
                className="block w-full max-h-40 min-h-11 resize-none bg-transparent py-2 text-[15.5px] text-ink outline-none"
              />
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[12.5px] text-ink-3 truncate">
                  {busy ? t('chat.thinking') : t('chat.subtitle')}
                </span>
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  className="grid place-items-center size-11 rounded-full bg-forest text-cream shrink-0 transition hover:brightness-125 disabled:opacity-35 disabled:cursor-not-allowed"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M12 19V5m-6 6 6-6 6 6"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span className="sr-only">{t('chat.send')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {desmos && (
        <DesmosSidePanel
          inset
          input={desmos}
          revealed={Boolean(ctx.chosen) || desmosRevealed}
          onReveal={() => setDesmosRevealed(true)}
          onClose={() => setDesmosOpen(false)}
          onView={setPanel}
          fetchImpl={fetchImpl}
        />
      )}
    </div>
  );
}

function SuuBubble({ msg, onRetry }: { msg: ChatMsg; onRetry: () => void }) {
  const t = useT('tutor');
  if (msg.status === 'pending') return <Pending />;
  if (msg.status === 'error') {
    return (
      <div className="flex items-center gap-3 rounded-2xl rounded-tl-md bg-danger-soft px-4 py-3 text-[14px] text-danger">
        <span>{t('chat.error')}</span>
        <Button size="sm" variant="danger" onClick={onRetry}>
          {t('chat.retry')}
        </Button>
      </div>
    );
  }
  return (
    <div className="grid max-w-[85%] gap-2 rounded-2xl rounded-tl-md bg-paper-2 px-4 py-3">
      {msg.demo && (
        <Pill tone="amber" className="w-fit">
          {t('chat.demo')}
        </Pill>
      )}
      {msg.sample && (
        <Pill tone="leaf" className="w-fit">
          {t('chat.sample')}
        </Pill>
      )}
      {msg.model && (
        <Pill tone={msg.model === 'suu' ? 'teal' : 'neutral'} className="w-fit">
          {t(msg.model === 'suu' ? 'chat.bySuu' : 'chat.byGemini')}
        </Pill>
      )}
      <Rich text={msg.text} className="text-[15px] leading-relaxed text-ink" />
      {msg.lesson && (
        <Link
          href={`${routes.desmosHome}/ai?l=${encodeURIComponent(msg.lesson)}`}
          className="mt-1 inline-flex w-fit items-center gap-2 rounded-xl bg-sage px-3.5 py-2 text-[14px] font-bold text-leaf-2 hover:brightness-105"
        >
          {t('chat.openDesmos')}
          <Icon name="chevron" size={16} />
        </Link>
      )}
      {!msg.demo && !msg.sample && msg.sent && (
        <FeedbackButtons
          mode={msg.sent.mode}
          prompt={msg.sent.message}
          reply={msg.text}
          context={msg.sent.context}
        />
      )}
    </div>
  );
}

/** "Суу бодож байна… 12 сек" — the counter appears after 3 s, so a slow model never looks frozen. */
function Pending() {
  const t = useT('tutor');
  const waited = useElapsed(true);
  return (
    <div className="rounded-2xl rounded-tl-md bg-paper-2 px-4 py-3 text-[15px] text-ink-3" role="status">
      <span className="animate-pulse">{t('chat.thinking')}</span>
      {waitLabel(waited, t('desmosPanel.seconds'))}
    </div>
  );
}
