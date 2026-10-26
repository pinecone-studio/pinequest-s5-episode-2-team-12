'use client';
// 👍/👎 under a Suu reply. 👎 opens an optional "better explanation" box.
// Sent to /api/tutor/feedback; a human reviews it before it can ever train the model (ai/pipeline/feedback.ts).
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n-client';
import type { TutorContextKind, TutorMode } from '@/types';

type Props = {
  mode: TutorMode;
  prompt: string;
  reply: string;
  context?: { kind: TutorContextKind; id?: string };
  fetchImpl?: typeof fetch;
};

type State = 'idle' | 'writing' | 'sending' | 'done' | 'error';

export function FeedbackButtons({ mode, prompt, reply, context, fetchImpl = fetch }: Props) {
  const t = useT('tutor');
  const [state, setState] = useState<State>('idle');
  const [correction, setCorrection] = useState('');
  // one box per Suu reply on the page → ids must be unique
  const boxId = useId();

  async function send(rating: 'up' | 'down', text?: string) {
    setState('sending');
    try {
      const res = await fetchImpl('/api/tutor/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, prompt, reply, context, rating, correction: text?.trim() || undefined }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'done') return <p className="text-[13px] text-ink-3">{t('feedback.thanks')}</p>;

  if (state === 'writing' || (state === 'sending' && correction)) {
    return (
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send('down', correction);
        }}
      >
        <label className="text-[13px] font-semibold" htmlFor={boxId}>
          {t('feedback.betterLabel')}
        </label>
        <textarea
          id={boxId}
          className="min-h-20 rounded-xl border border-line bg-paper p-3 text-[14px]"
          maxLength={2000}
          placeholder={t('feedback.betterPlaceholder')}
          value={correction}
          onChange={(e) => setCorrection(e.target.value)}
        />
        <p className="text-[12px] text-ink-3">{t('feedback.privacy')}</p>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={state === 'sending'}>
            {t('feedback.send')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void send('down')}>
            {t('feedback.skip')}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] text-ink-3">{t('feedback.question')}</span>
      <Button
        size="sm"
        variant="ghost"
        aria-label={t('feedback.up')}
        disabled={state === 'sending'}
        onClick={() => void send('up')}
      >
        👍
      </Button>
      <Button
        size="sm"
        variant="ghost"
        aria-label={t('feedback.down')}
        disabled={state === 'sending'}
        onClick={() => setState('writing')}
      >
        👎
      </Button>
      {state === 'error' && <span className="text-[13px] text-danger">{t('feedback.error')}</span>}
    </div>
  );
}
