'use client';
// /profile/mock/[id]/compare?with=…: this test vs an earlier one — score delta, per-domain deltas, the two
// 4-domain radars overlaid, and which topics got better or worse.
import Link from 'next/link';
import { useId } from 'react';
import { RadarChart } from '@/components/charts/RadarChart';
import { compareAttempts, type MockAttempt } from '@/features/exam/lib/mock';
import { topicById } from '@/features/roadmap/topics';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { DOMAIN_AXES, type QuestionMeta } from '../lib/radar';
import { fmtDate, useAttempts } from './MockResult';

const share = (d: { correct: number; total: number }) => (d.total ? d.correct / d.total : null);

function Delta({ n, unit = '' }: { n: number; unit?: string }) {
  const up = n > 0;
  const flat = n === 0;
  return (
    <span className={cn('font-bold tnum', flat ? 'text-ink-3' : up ? 'text-leaf-2' : 'text-danger')}>
      {flat ? '±0' : `${up ? '▲ +' : '▼ '}${n}`}
      {unit}
    </span>
  );
}

export function MockCompare({
  id,
  withId,
  demo,
  attempts: serverAttempts,
  meta,
}: {
  id: string;
  withId: string | null;
  demo: boolean;
  attempts: MockAttempt[];
  meta: QuestionMeta;
}) {
  const t = useT('profile');
  const te = useT('exam');
  const attempts = useAttempts(demo, serverAttempts);
  const uid = useId();
  if (!attempts) return <p className="text-ink-3">{t('result.loading')}</p>;
  const current = attempts.find((a) => a.id === id);
  const previous =
    attempts.find((a) => a.id === withId) ??
    attempts.find(
      (a) => a.id !== id && current && Date.parse(a.finishedAt!) < Date.parse(current.finishedAt!),
    );
  if (!current || !previous)
    return (
      <div className="grid gap-3">
        <p className="text-ink-2">{current ? t('result.noPrevious') : t('result.notFound')}</p>
        <Link
          href={current ? routes.mockResult(id) : routes.profile}
          className="font-bold text-leaf-2 underline"
        >
          {t('result.back')}
        </Link>
      </div>
    );

  const c = compareAttempts(current, previous, (qid) => meta[qid]?.[0]);
  const pct = (v: number) => Math.round(v * 100);
  const topicList = (items: typeof c.improved) =>
    items.length === 0 ? (
      <p className="text-[13.5px] text-ink-3">{t('compare.none')}</p>
    ) : (
      <ul className="grid gap-1.5 text-[13.5px]">
        {items.map((x) => (
          <li key={x.topicId} className="flex items-center justify-between gap-3">
            <span className="text-ink-2">{topicById(x.topicId)?.title}</span>
            <span className="tnum text-ink-3">
              {pct(x.before)}% → <span className="font-bold text-ink">{pct(x.after)}%</span>
            </span>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5">
      <Link href={routes.mockResult(id)} className="text-[13px] font-bold text-ink-2 hover:text-ink">
        ← {t('result.title')}
      </Link>
      <header className="soft-card grid gap-4 p-5 md:p-6">
        <h1 className="font-display text-2xl font-bold text-ink">{t('compare.title')}</h1>
        <div className="grid grid-cols-3 items-end gap-3 text-center">
          <div>
            <p className="text-[12px] text-ink-3">
              {t('compare.previous')} · {fmtDate(previous.finishedAt!)}
            </p>
            <p className="font-display text-3xl font-bold text-ink-2 tnum">{previous.score}</p>
          </div>
          <div>
            <p className="text-[12px] text-ink-3">{t('compare.delta')}</p>
            <p className="font-display text-[44px] leading-none">
              <Delta n={c.scoreDelta} />
            </p>
          </div>
          <div>
            <p className="text-[12px] text-ink-3">
              {t('compare.current')} · {fmtDate(current.finishedAt!)}
            </p>
            <p className="font-display text-3xl font-bold text-ink tnum">{current.score}</p>
          </div>
        </div>
        <p className="text-[12px] text-ink-3">{t('result.disclaimer')}</p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        <section className="soft-card grid content-start gap-3 p-5" aria-labelledby={`${uid}-cmp-domains`}>
          <h2 id={`${uid}-cmp-domains`} className="font-bold text-ink">
            {t('compare.domains')}
          </h2>
          <ul className="grid gap-2 text-[13.5px]">
            {DOMAIN_AXES.map((d) => (
              <li key={d} className="flex items-center justify-between gap-3">
                <span className="text-ink-2">{te(`domainsFull.${d}`)}</span>
                <span className="tnum text-ink-3">
                  {previous.domains[d].correct}/{previous.domains[d].total} → {current.domains[d].correct}/
                  {current.domains[d].total} <Delta n={Math.round(c.domainDeltas[d] * 100)} unit="%" />
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="soft-card grid content-start gap-3 p-5" aria-labelledby={`${uid}-cmp-radar`}>
          <h2 id={`${uid}-cmp-radar`} className="font-bold text-ink">
            {t('compare.radar')}
          </h2>
          <RadarChart
            axes={DOMAIN_AXES.map((d) => te(`domains.${d}`))}
            series={[
              {
                id: 'cur',
                label: t('compare.current'),
                values: DOMAIN_AXES.map((d) => share(current.domains[d])),
                color: 'var(--chart-1)',
              },
              {
                id: 'prev',
                label: t('compare.previous'),
                values: DOMAIN_AXES.map((d) => share(previous.domains[d])),
                color: 'var(--chart-2)',
              },
            ]}
            caption={t('compare.radar')}
            emptyLabel={t('radar.empty')}
          />
        </section>
        <section className="soft-card grid content-start gap-3 p-5" aria-labelledby={`${uid}-cmp-up`}>
          <h2 id={`${uid}-cmp-up`} className="font-bold text-ink">
            {t('compare.improved')}
          </h2>
          {topicList(c.improved)}
        </section>
        <section className="soft-card grid content-start gap-3 p-5" aria-labelledby={`${uid}-cmp-down`}>
          <h2 id={`${uid}-cmp-down`} className="font-bold text-ink">
            {t('compare.worse')}
          </h2>
          {topicList(c.worse)}
        </section>
      </div>
    </div>
  );
}
