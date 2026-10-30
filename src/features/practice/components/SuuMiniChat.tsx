'use client';
// A compact chat with Суу for the floating window: same /api/tutor backend as the full /tutor page,
// without its history sidebar. The full page stays one click away.
import Link from 'next/link';
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { Rich } from '@/components/math';
import { askSuu, type ChatMsg, newId, patch, requestFor } from '@/features/tutor/lib/chat';
import { cn } from '@/lib/cn';
import type { TutorContext } from '@/types';

const GENERAL: TutorContext = { kind: 'general', title: 'SAT Math' };

export function SuuMiniChat({ fetchImpl = fetch }: { fetchImpl?: typeof fetch }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const busy = messages.some((m) => m.status === 'pending');

  useEffect(() => {
    if (messages.length === 0) return;
    endRef.current?.scrollIntoView?.({ block: 'end' });
  }, [messages]);

  async function send(text: string, retryOf?: string) {
    const at = retryOf ? messages.findIndex((m) => m.id === retryOf) : -1;
    const before = at > 0 ? messages.slice(0, at - 1) : messages;
    const req = requestFor({ kind: 'free', text }, GENERAL, { messages: before });
    if (!req || (busy && !retryOf)) return;
    const replyId = retryOf ?? newId('suu');
    if (retryOf) {
      setMessages((list) => patch(list, retryOf, { status: 'pending', text: '' }));
    } else {
      setMessages((list) => [
        ...list,
        { id: newId('me'), role: 'user', text: text.trim() },
        { id: replyId, role: 'suu', text: '', status: 'pending', sent: req },
      ]);
      setDraft('');
    }
    try {
      const reply = await askSuu(req, fetchImpl);
      setMessages((list) =>
        patch(list, replyId, { text: reply.text, model: reply.model, status: undefined }),
      );
    } catch {
      setMessages((list) => patch(list, replyId, { status: 'error' }));
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm text-ink-2">
            Сайн уу! Би Суу 🐱 Бодлогоо хуулж тавиад асуу, эсвэл ойлгомжгүй алхмаа бичээрэй.
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={m.id}
            className={cn(
              'max-w-[90%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
              m.role === 'user' ? 'ml-auto bg-leaf text-on-leaf' : 'bg-paper-2 text-ink',
            )}
          >
            {m.status === 'pending' ? (
              <span className="text-ink-3">Суу бодож байна…</span>
            ) : m.status === 'error' ? (
              <span className="flex flex-wrap items-center gap-2 text-ink-2">
                Хариу ирсэнгүй.
                <button
                  type="button"
                  onClick={() => void send(messages[i - 1]?.text ?? '', m.id)}
                  className="font-bold text-leaf-2 underline underline-offset-2"
                >
                  Дахин оролдох
                </button>
              </span>
            ) : m.role === 'suu' ? (
              <Rich text={m.text} />
            ) : (
              <span className="whitespace-pre-wrap">{m.text}</span>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-line p-3">
        <label htmlFor={inputId} className="sr-only">
          Суу-д асуух
        </label>
        <textarea
          id={inputId}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Асуултаа бич…"
          className="min-h-0 flex-1 resize-none rounded-xl border border-line bg-paper-2 px-3 py-2 text-sm text-ink placeholder:text-ink-3"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-xl bg-leaf px-4 py-2 text-sm font-bold text-on-leaf hover:bg-leaf-2 disabled:opacity-50"
        >
          Илгээх
        </button>
      </form>
      <Link
        href="/tutor"
        className="px-4 pb-3 text-xs font-semibold text-leaf-2 underline underline-offset-4"
      >
        Суу-г бүтэн дэлгэцээр нээх
      </Link>
    </div>
  );
}
