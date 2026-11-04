'use client';
// /admin/users/[id]: one student — who they are, what they answered at onboarding, how they are doing,
// reports against them and their latest XP. Same «Эрдэнэ» / admin buttons as the list.
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/brand/Avatar';
import { Flame } from '@/components/shell/icons';
import { Pill } from '@/components/ui/Pill';
import { statsFromXp } from '@/features/progress/lib/stats';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { formatDateTime, formatDay } from '../lib/format';
import type { AdminUserDetail } from '../queries';
import { UserActions } from './UsersView';

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('soft-card grid content-start gap-3 p-5', className)}>
      <h2 className="font-bold text-[17px] text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** Label / value tiles; a missing value reads «Оруулаагүй». */
function Facts({ rows }: { rows: [string, ReactNode | null | undefined][] }) {
  const t = useT('admin');
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-2xl bg-paper-2 px-4 py-3">
          <dt className="text-[12px] text-ink-3">{k}</dt>
          <dd className={cn('mt-0.5 font-semibold', v == null || v === '' ? 'text-ink-3' : 'text-ink')}>
            {v == null || v === '' ? t('detail.notSet') : v}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function UserDetailView({ detail, me }: { detail: AdminUserDetail; me: string | null }) {
  const t = useT('admin');
  const ob = useT('onboarding');
  const p = detail.profile;
  const name = p.name || p.username || p.email || t('users.guest');
  const stats = statsFromXp(detail.xp_rows, undefined, detail.freezes);
  const accuracy = detail.answers.total
    ? Math.round((detail.answers.correct / detail.answers.total) * 100)
    : null;
  const num = (n: number) => n.toLocaleString('en-US');

  const tiles: { key: string; value: ReactNode; sub?: string }[] = [
    { key: 'level', value: stats.level, sub: t('detail.xp', { n: num(stats.xp) }) },
    {
      key: 'streak',
      value: (
        <span className="inline-flex items-center gap-1.5">
          <Flame size={22} /> {stats.streak}
        </span>
      ),
      sub: t('detail.studyDays', { n: stats.days.length }),
    },
    { key: 'gems', value: `💎 ${num(detail.gems)}` },
    {
      key: 'answers',
      value: num(detail.answers.total),
      sub: accuracy === null ? undefined : t('detail.accuracy', { n: accuracy }),
    },
  ];

  return (
    <>
      <Link
        href={routes.adminUsers()}
        className="w-fit text-[14px] font-semibold text-leaf-2 hover:underline"
      >
        ← {t('detail.back')}
      </Link>

      <section className="soft-card grid gap-4 p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={name} avatarId={p.avatar_id} size={76} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[26px] font-bold leading-tight text-ink">{name}</h1>
              <Pill tone={p.role === 'admin' ? 'dark' : 'neutral'}>{t(`users.role.${p.role}`)}</Pill>
              {p.id === me && <Pill tone="leaf">{t('users.you')}</Pill>}
              {p.anonymous && <Pill>{t('users.guest')}</Pill>}
              {!p.anonymous && !p.email_confirmed && <Pill tone="amber">{t('detail.unconfirmed')}</Pill>}
              {!p.anonymous && !p.onboarded && <Pill tone="amber">{t('users.notOnboarded')}</Pill>}
            </div>
            <p className="mt-0.5 text-[13.5px] text-ink-2">
              {[p.username && `@${p.username}`, p.email].filter(Boolean).join(' · ') || '—'}
            </p>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              {t('users.joined', { date: formatDay(p.created_at) })} ·{' '}
              {t('users.lastSeen', {
                date: p.last_sign_in_at ? formatDateTime(p.last_sign_in_at) : t('users.never'),
              })}
            </p>
          </div>
          <UserActions
            user={{ id: p.id, role: p.role, anonymous: p.anonymous }}
            name={name}
            self={p.id === me}
          />
        </div>
        <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {tiles.map((s) => (
            <div key={s.key} className="rounded-2xl bg-paper-2 px-4 py-3">
              <dt className="text-[12px] text-ink-3">{t(`detail.tiles.${s.key}`)}</dt>
              <dd className="font-display text-2xl font-bold text-ink tnum">{s.value}</dd>
              {s.sub && <dd className="text-[12px] text-ink-3">{s.sub}</dd>}
            </div>
          ))}
        </dl>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Section title={t('detail.about')}>
          <Facts
            rows={[
              [t('detail.aimag'), p.aimag],
              [t('detail.school'), p.school],
              [ob('experience'), p.sat_exp && ob(`sat.${p.sat_exp}`)],
              ...(p.sat_exp === 'taken'
                ? ([[t('detail.lastScore'), p.last_math_score]] as [string, ReactNode][])
                : []),
              [t('detail.target'), p.target],
              [t('detail.examDate'), p.exam_date ?? ob('noDate')],
              [t('detail.confidence'), p.confidence && `${p.confidence} / 5`],
              [ob('desmos'), p.desmos && ob(`desmosOptions.${p.desmos}`)],
              [t('detail.minutes'), p.study_minutes && ob('minuteOption', { n: p.study_minutes })],
              [t('detail.start'), p.start && ob(`focusOptions.${p.start}`)],
            ]}
          />
        </Section>

        <Section title={t('detail.activity')}>
          <Facts
            rows={[
              [t('detail.placement'), detail.roadmap.level],
              [
                t('detail.stops'),
                t('detail.stopsValue', { n: detail.roadmap.done, stars: detail.roadmap.stars }),
              ],
              [t('detail.currentStop'), detail.roadmap.current_stop],
              [t('detail.answersWeek'), num(detail.answers.week)],
              [t('detail.cards'), num(detail.counts.cards)],
              [t('detail.mistakes'), num(detail.counts.mistakes_open)],
              [t('detail.friends'), num(detail.counts.friends)],
              [t('detail.badges'), num(detail.counts.badges)],
              [t('detail.aiWeek'), num(detail.counts.ai_week)],
              [t('detail.reportsMade'), num(detail.counts.reports_made)],
            ]}
          />
          <p className="text-[12.5px] text-ink-3">
            {[
              p.friend_code && t('detail.friendCode', { code: p.friend_code }),
              p.hide_public && t('detail.hidePublic'),
              p.friends_only && t('detail.friendsOnly'),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </Section>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Section title={t('detail.mocks', { n: detail.mocks.length })}>
          {detail.mocks.length === 0 ? (
            <p className="text-sm text-ink-2">{t('detail.none')}</p>
          ) : (
            <ul className="grid gap-2">
              {detail.mocks.map((m) => (
                <li key={m.id} className="flex items-center gap-3 rounded-xl bg-paper-2 px-3.5 py-2.5">
                  <span className="flex-1 text-[13.5px] text-ink-2 tnum">
                    {formatDateTime(m.finished_at)}
                  </span>
                  {m.kind && <Pill>{m.kind}</Pill>}
                  <span className="font-display text-lg font-bold text-ink tnum">{m.score ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t('detail.reports', { n: detail.reports.filter((r) => !r.resolved).length })}>
          {detail.reports.length === 0 ? (
            <p className="text-sm text-ink-2">{t('detail.none')}</p>
          ) : (
            <ul className="grid gap-2">
              {detail.reports.map((r) => (
                <li
                  key={r.id}
                  className={cn(
                    'flex flex-wrap items-center gap-2 rounded-xl bg-paper-2 px-3.5 py-2.5',
                    r.resolved && 'opacity-60',
                  )}
                >
                  <Pill tone={r.reason === 'harassment' || r.reason === 'cheating' ? 'danger' : 'amber'}>
                    {t(`reports.reason.${r.reason}`)}
                  </Pill>
                  <Pill>{t(`reports.context.${r.context}`)}</Pill>
                  {r.resolved && <Pill tone="leaf">{t('reports.resolved')}</Pill>}
                  <span className="ml-auto text-[12px] text-ink-3">
                    {r.reporter_name || t('reports.unknown')} · {formatDay(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {detail.reports.some((r) => !r.resolved) && (
            <Link
              href={routes.adminReports()}
              className="w-fit text-[13.5px] font-semibold text-leaf-2 hover:underline"
            >
              {t('detail.openReports')} →
            </Link>
          )}
        </Section>
      </div>

      <Section title={t('detail.recentXp')}>
        {detail.recent_xp.length === 0 ? (
          <p className="text-sm text-ink-2">{t('detail.none')}</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {detail.recent_xp.map((e) => (
              <li
                key={`${e.at}-${e.reason}`}
                className="flex items-center gap-3 rounded-xl bg-paper-2 px-3.5 py-2"
              >
                <span className="w-14 font-bold text-leaf-2 tnum">+{e.amount}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{e.reason}</span>
                <span className="text-[12px] text-ink-3 tnum">{formatDateTime(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
