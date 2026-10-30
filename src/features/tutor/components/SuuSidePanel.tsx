'use client';
// The «AI багш Суу» button next to a problem opens this panel: the screen splits in half. On a wide screen
// the problem stays on the left and Суу takes the right column; on a phone Суу slides up over the bottom half.
// It is the tutor chat (POST /api/tutor) about this one problem: quick actions plus free questions. The full
// walk-through stays locked until the student has answered, like the last step of the Desmos panel.
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import type { TutorContext, TutorMode } from '@/types';
import { askSuu, type ChatAction, type ChatMsg, newId, patch, requestFor, userBubbleText } from '../lib/chat';
import { PANEL_MODES, SOLUTION_MODES } from '../lib/suu-panel';
import { SuuBubble } from './TutorChat';

type Props = {
  /** The problem: `kind: 'question'` with its text in `problem` (and the student's answer in `chosen`). */
  context: TutorContext;
  /** The student has answered: the full explanation unlocks. */
  revealed: boolean;
  onClose: () => void;
  fetchImpl?: typeof fetch;
};

/** Wrapper classes for the page that hosts the panel: two columns on a wide screen, room below on a phone. */
export function splitLayout(open: boolean, closedWidth: string): string {
  return open
    ? 'max-w-[1280px] pb-[56dvh] lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:pb-0'
    : closedWidth;
}

function SuuFace({ size }: { size: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-[30%] bg-sage"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {/* biome-ignore lint/performance/noImgElement: static transparent image */}
      <img src="/brand/suu-logo-head.webp" alt="" width={size} height={size} className="w-[88%] h-auto" />
    </span>
  );
}

/** The button that opens the panel. */
export function SuuTutorButton({
  open,
  onClick,
  disabled,
  className,
}: {
  open: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT('tutor');
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={open}
      aria-label={open ? t('suuPanel.close') : t('suuPanel.open')}
      className={cn(
        'inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
        open
          ? 'border-leaf bg-sage text-leaf-2'
          : 'border-line bg-paper-2 text-ink hover:border-leaf hover:text-leaf-2',
        className,
      )}
    >
      <SuuFace size={28} />
      {t('suuPanel.button')}
    </button>
  );
}

export function SuuSidePanel({ context, revealed, onClose, fetchImpl }: Props) {
  const t = useT('tutor');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const busy = messages.some((m) => m.status === 'pending');
  const problem = context.problem ?? '';

  // a new problem starts a new conversation
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the problem changes
  useEffect(() => {
    setMessages([]);
    setDraft('');
  }, [problem]);

  useEffect(() => {
    if (messages.length === 0) return;
    // happy-dom in tests may not implement scrollIntoView
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(action: ChatAction, retryOf?: string) {
    const req = requestFor(action, context);
    if (!req || busy) return;
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
        patch(list, replyId, { text: reply.text, sample: reply.sample, status: undefined }),
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

  function submit(e?: FormEvent) {
    e?.preventDefault();
    void run({ kind: 'free', text: draft });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <aside
      aria-label={t('suuPanel.title')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 flex h-[55dvh] flex-col overflow-hidden rounded-t-[1.75rem] border-t border-line bg-paper shadow-pop',
        'lg:sticky lg:top-4 lg:z-auto lg:h-[calc(100dvh-120px)] lg:rounded-[2rem] lg:border',
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <SuuFace size={32} />
          <h2 className="truncate font-bold text-ink">{t('suuPanel.title')}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('suuPanel.close')}
          className="grid size-9 shrink-0 place-items-center rounded-xl text-[22px] leading-none text-ink-3 hover:bg-paper-2 hover:text-ink"
        >
          ×
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-4 py-3" aria-live="polite">
        {messages.length === 0 ? (
          <p className="rounded-2xl rounded-tl-md bg-paper-2 px-4 py-3 text-[15px] leading-relaxed text-ink-2">
            {t('suuPanel.empty')}
          </p>
        ) : (
          <ol className="grid gap-3">
            {messages.map((m) => (
              <li key={m.id} className={cn('flex', m.role === 'user' && 'justify-end')}>
                {m.role === 'user' ? (
                  <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-leaf px-4 py-2.5 text-[15px] text-on-leaf">
                    <span className="sr-only">{t('chat.you')}: </span>
                    {m.text}
                  </p>
                ) : (
                  <SuuBubble msg={m} onRetry={() => retry(m)} />
                )}
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>

      <div className="grid gap-2 border-t border-line px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {PANEL_MODES.map((mode) => {
            const locked = SOLUTION_MODES.has(mode) && !revealed;
            return (
              <Button
                key={mode}
                size="sm"
                variant="soft"
                disabled={busy || locked || !problem}
                title={locked ? t('suuPanel.locked') : undefined}
                onClick={() => run({ kind: 'quick', mode })}
              >
                {locked && <span aria-hidden>🔒 </span>}
                {t(`modes.${mode}`)}
              </Button>
            );
          })}
        </div>
        {!revealed && <p className="text-xs text-ink-3">{t('suuPanel.locked')}</p>}
        <form onSubmit={submit} className="flex items-end gap-2">
          <label htmlFor={inputId} className="sr-only">
            {t('suuPanel.inputLabel')}
          </label>
          <textarea
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={400}
            placeholder={t('suuPanel.placeholder')}
            className="min-h-11 flex-1 resize-none rounded-2xl border border-line bg-paper-2 px-4 py-2.5 text-[15px] text-ink placeholder:text-ink-3"
          />
          <Button type="submit" disabled={busy || !draft.trim()}>
            {t('chat.send')}
          </Button>
        </form>
      </div>
    </aside>
  );
}
