'use client';
// /admin/feedback: review the 👍/👎 students gave Суу. Only 'approved' rows reach ai/pipeline/feedback.ts.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { reviewFeedback } from '../actions';
import { FEEDBACK_FILTERS, type FeedbackFilter } from '../lib/filters';
import { formatDateTime } from '../lib/format';
import type { AdminFeedback, FeedbackStatus } from '../queries';

const STATUS_TONE = { new: 'amber', approved: 'leaf', rejected: 'danger' } as const;

function Block({ label, text, tone }: { label: string; text: string; tone?: 'leaf' }) {
  return (
    <div className={cn('rounded-xl px-3.5 py-3', tone === 'leaf' ? 'bg-sage' : 'bg-paper-2')}>
      <div className="text-[12px] font-semibold text-ink-3">{label}</div>
      <p className="mt-1 whitespace-pre-wrap wrap-break-word text-[14px] leading-relaxed text-ink">{text}</p>
    </div>
  );
}

function FeedbackCard({ item }: { item: AdminFeedback }) {
  const t = useT('admin');
  const router = useRouter();
  const id = useId();
  const [note, setNote] = useState(item.review_note ?? '');
  const [busy, setBusy] = useState(false);

  const set = async (status: FeedbackStatus) => {
    setBusy(true);
    const r = await reviewFeedback({ id: item.id, status, note });
    setBusy(false);
    if (!r.ok) return toast(r.reason === 'not_found' ? t('errors.not_found') : t('errors.failed'));
    toast(t('feedback.saved'));
    router.refresh();
  };

  return (
    <li className="soft-card grid gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[20px]" role="img" aria-label={item.rating}>
          {item.rating === 'up' ? '👍' : '👎'}
        </span>
        <span className="font-bold text-ink">{item.user_name || t('feedback.anonymous')}</span>
        <Pill tone={STATUS_TONE[item.status]}>{t(`feedback.filter.${item.status}`)}</Pill>
        <Pill>{item.mode}</Pill>
        {item.context_kind && <Pill>{item.context_kind}</Pill>}
        <span className="ml-auto text-[12px] text-ink-3 tnum">
          {item.model} · {formatDateTime(item.created_at)}
        </span>
      </div>
      <Block label={t('feedback.prompt')} text={item.prompt} />
      <Block label={t('feedback.reply')} text={item.reply} />
      {item.correction && <Block label={t('feedback.correction')} text={item.correction} tone="leaf" />}
      <label className="grid gap-1 text-[12px] font-semibold text-ink-3" htmlFor={id}>
        {t('feedback.note')}
        <textarea
          id={id}
          rows={2}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t('feedback.notePlaceholder')}
          className="w-full rounded-2xl border border-line bg-paper px-3 py-2 text-[14px] text-ink"
        />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        {item.status !== 'new' && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => set('new')}>
            {t('feedback.reset')}
          </Button>
        )}
        <Button variant="danger" size="sm" disabled={busy} onClick={() => set('rejected')}>
          {t('feedback.reject')}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => set('approved')}>
          {t('feedback.approve')}
        </Button>
      </div>
    </li>
  );
}

export function FeedbackView({ items, filter }: { items: AdminFeedback[]; filter: FeedbackFilter }) {
  const t = useT('admin');
  return (
    <>
      <PageHeader title={t('feedback.title')} description={t('feedback.lead')} icon="feedback" />
      <nav className="flex flex-wrap gap-2" aria-label={t('feedback.title')}>
        {FEEDBACK_FILTERS.map((f) => (
          <Link
            key={f}
            href={routes.adminFeedback(f === 'new' ? undefined : f)}
            aria-current={f === filter ? 'page' : undefined}
            className={cn(
              'h-10 px-4 grid place-items-center rounded-xl text-[14px] font-semibold border transition-colors',
              f === filter ? 'bg-sage text-leaf-2 border-sage-2' : 'border-line text-ink-2 hover:bg-paper-2',
            )}
          >
            {t(`feedback.filter.${f}`)}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="soft-card p-6 text-center text-ink-2">{t('feedback.empty')}</p>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <FeedbackCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </>
  );
}
