// /admin: headline numbers, a 14-day sign-up / activity chart, and what is waiting for review.
import Link from 'next/link';
import { Icon } from '@/components/shell/icons';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { getT } from '@/lib/i18n';
import { routes } from '@/lib/routes';
import { shortDay } from '../lib/format';
import type { AdminDay, AdminOverview } from '../queries';

const num = (n: number) => n.toLocaleString('en-US');

function ActivityChart({ days }: { days: AdminDay[] }) {
  const t = getT('admin');
  const max = Math.max(1, ...days.flatMap((d) => [d.signups, d.active]));
  return (
    <section className="soft-card grid content-start gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-[17px] text-ink">{t('overview.chart.title')}</h2>
        <div className="flex items-center gap-4 text-[12.5px] text-ink-2">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-leaf" aria-hidden="true" />
            {t('overview.chart.signups')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-teal" aria-hidden="true" />
            {t('overview.chart.active')}
          </span>
        </div>
      </div>
      <ol className="grid h-44 grid-cols-14 items-end gap-1.5 sm:gap-2.5">
        {days.map((d) => {
          const label = t('overview.chart.day', { day: d.day, signups: d.signups, active: d.active });
          return (
            <li key={d.day} title={label} className="grid h-full grid-rows-[1fr_auto] gap-1.5">
              <span className="sr-only">{label}</span>
              <div className="flex items-end justify-center gap-0.5 sm:gap-1" aria-hidden="true">
                <span
                  className="w-full max-w-3 rounded-t-sm bg-leaf"
                  style={{ height: `${Math.max(d.signups ? 6 : 2, (d.signups / max) * 100)}%` }}
                />
                <span
                  className="w-full max-w-3 rounded-t-sm bg-teal"
                  style={{ height: `${Math.max(d.active ? 6 : 2, (d.active / max) * 100)}%` }}
                />
              </div>
              <span className="text-center text-[10.5px] text-ink-3 tnum" aria-hidden="true">
                {shortDay(d.day)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Todo({ data }: { data: AdminOverview }) {
  const t = getT('admin');
  const rows = [
    { key: 'reports', n: data.open_reports, href: routes.adminReports(), icon: 'flag' },
    { key: 'feedback', n: data.new_feedback, href: routes.adminFeedback(), icon: 'feedback' },
    { key: 'review', n: data.pending_review, href: routes.adminQuestions, icon: 'bank' },
  ];
  const clear = rows.every((r) => r.n === 0);
  return (
    <section className="soft-card grid content-start gap-3 p-5">
      <h2 className="font-bold text-[17px] text-ink">{t('overview.todo.title')}</h2>
      {clear && <p className="text-sm text-ink-2">{t('overview.todo.none')}</p>}
      <ul className="grid gap-2">
        {rows.map((r) => (
          <li key={r.key}>
            <Link
              href={r.href}
              className="flex items-center gap-3 rounded-xl border border-line bg-paper-2 px-3.5 py-3 hover:border-leaf"
            >
              <Icon name={r.icon} size={20} className="shrink-0 text-ink-3" />
              <span className="flex-1 text-[14px] font-semibold text-ink">{t(`overview.todo.${r.key}`)}</span>
              <Pill tone={r.n > 0 ? 'amber' : 'neutral'}>
                <span className="tnum">{num(r.n)}</span>
              </Pill>
              <Icon name="chevron" size={16} className="text-ink-3" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OverviewView({ data }: { data: AdminOverview }) {
  const t = getT('admin');
  const stats: { key: string; n: number; sub?: string }[] = [
    { key: 'users', n: data.users, sub: t('overview.sub.onboarded', { n: data.onboarded }) },
    { key: 'new7d', n: data.new_7d, sub: t('overview.sub.guests', { n: data.guests }) },
    { key: 'active1d', n: data.active_1d },
    { key: 'active7d', n: data.active_7d, sub: t('overview.sub.admins', { n: data.admins }) },
    { key: 'answers7d', n: data.answers_7d },
    { key: 'mocks', n: data.mocks },
    { key: 'ai7d', n: data.ai_7d },
    { key: 'xp', n: data.xp_total },
  ];
  return (
    <>
      <PageHeader title={t('overview.title')} description={t('overview.lead')} icon="admin" />
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.key} className="stat-card">
            <dt className="text-[12px] text-ink-3">{t(`overview.stats.${s.key}`)}</dt>
            <dd className="font-display text-2xl font-bold text-ink tnum">{num(s.n)}</dd>
            {s.sub && <dd className="mt-1! text-[12px]! tracking-normal! font-normal text-ink-3">{s.sub}</dd>}
          </div>
        ))}
      </dl>
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <ActivityChart days={data.days} />
        <Todo data={data} />
      </div>
    </>
  );
}
