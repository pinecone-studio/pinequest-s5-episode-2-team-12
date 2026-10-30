'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type FormEvent, useId, useState, useTransition } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DownloadQuestions } from '@/features/offline/DownloadQuestions';
import { SuuSidePanel } from '@/features/tutor/components/SuuSidePanel';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import type { Domain } from '@/types';
import {
  OFFICIAL_PAGE_SIZE,
  OFFICIAL_SKILLS,
  type OfficialFilter,
  type OfficialPage,
  officialFilterToParams,
} from '../lib/official';
import { OfficialQuestionCard, type SuuState } from './OfficialQuestionCard';

const DOMAINS: (Domain | 'all')[] = ['all', 'alg', 'adv', 'psda', 'geo'];
const field =
  'w-full rounded-2xl border border-line bg-paper-2 px-4 py-3 text-ink placeholder:text-sm placeholder:text-ink-3';
const chip = 'rounded-xl border px-4 py-2 text-xs font-bold transition';

/** /bank with the official College Board questions: filters live in the URL, one page per request. */
export function OfficialBank({ data, filter }: { data: OfficialPage; filter: OfficialFilter }) {
  const t = useT('practice');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const [resetKeys, setResetKeys] = useState<Record<string, number>>({});
  const [search, setSearch] = useState(filter.search ?? '');
  const searchId = useId();
  // the question open in the «AI багш Суу» side panel, and what its card reports (checked, the answer given)
  const [suu, setSuu] = useState<({ id: string } & SuuState) | null>(null);
  const suuQuestion = suu ? data.questions.find((q) => q.id === suu.id) : undefined;

  function go(next: Partial<OfficialFilter>) {
    const params = officialFilterToParams({ ...filter, page: 1, ...next });
    start(() => router.push(`${pathname}?view=official${params ? `&${params}` : ''}`));
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    go({ search: search.trim() || undefined });
  }

  const skillGroups = filter.domain
    ? [[filter.domain, OFFICIAL_SKILLS[filter.domain]] as const]
    : (Object.entries(OFFICIAL_SKILLS) as [Domain, string[]][]);
  const hasFilters = Boolean(filter.domain || filter.skill || filter.difficulty || filter.search);
  const firstIndex = (data.page - 1) * OFFICIAL_PAGE_SIZE;

  return (
    <div className="workspace-page max-w-6xl text-ink">
      <PageHeader title={t('pages.bank.title')} description={t('official.lead')} icon="bank">
        <div className="rounded-2xl border border-line bg-paper px-5 py-3 text-right">
          <span className="block font-display text-2xl font-bold text-leaf-2 tnum">{data.bankTotal}</span>
          <span className="text-xs font-semibold text-ink-3">{t('bank.available')}</span>
        </div>
      </PageHeader>

      <DownloadQuestions questions={data.questions} />

      <section className="section-panel space-y-5 p-5 sm:p-6">
        <div className="space-y-2.5">
          <h2 className="eyebrow text-ink-3">{t('bank.domain')}</h2>
          <nav className="flex flex-wrap gap-2" aria-label={t('bank.domainsLabel')}>
            {DOMAINS.map((d) => {
              const active = (filter.domain ?? 'all') === d;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  onClick={() => go({ domain: d === 'all' ? undefined : d, skill: undefined })}
                  className={cn(
                    chip,
                    active
                      ? 'border-leaf bg-leaf/10 text-leaf-2'
                      : 'border-line bg-paper-2 text-ink-3 hover:border-leaf hover:text-ink',
                  )}
                >
                  {t(`bank.domains.${d}`)}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="eyebrow text-ink-3">{t('official.skill')}</span>
            <select
              value={filter.skill ?? ''}
              onChange={(e) => go({ skill: e.target.value || undefined })}
              className={field}
            >
              <option value="">{t('official.allSkills')}</option>
              {skillGroups.map(([domain, skills]) => (
                <optgroup key={domain} label={t(`bank.domains.${domain}`)}>
                  {skills.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="eyebrow text-ink-3">{t('bank.difficulty')}</span>
            <select
              value={filter.difficulty ?? 'all'}
              onChange={(e) =>
                go({
                  difficulty: e.target.value === 'all' ? undefined : (Number(e.target.value) as 1 | 2 | 3),
                })
              }
              className={field}
            >
              <option value="all">{t('bank.allDifficulties')}</option>
              <option value="1">{t('bank.easy')}</option>
              <option value="2">{t('bank.medium')}</option>
              <option value="3">{t('bank.hard')}</option>
            </select>
          </label>

          <form onSubmit={submitSearch} className="space-y-2" role="search">
            <label htmlFor={searchId} className="eyebrow block text-ink-3">
              {t('bank.search')}
            </label>
            <div className="flex gap-2">
              <input
                id={searchId}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('bank.searchPlaceholder')}
                className={field}
              />
              <button
                type="submit"
                className="shrink-0 rounded-2xl bg-leaf px-4 text-sm font-bold text-on-leaf hover:bg-leaf-2"
              >
                {t('official.searchButton')}
              </button>
            </div>
          </form>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-ink-3">
        <p aria-live="polite">{t('bank.found', { n: data.total })}</p>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              go({ domain: undefined, skill: undefined, difficulty: undefined, search: undefined });
            }}
            className="font-bold text-leaf-2 hover:underline"
          >
            {t('official.clear')}
          </button>
        )}
      </div>

      <div className={cn(suuQuestion && 'pb-[56dvh] lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:pb-0')}>
        <section
          className={cn('min-w-0 space-y-3 transition-opacity', pending && 'opacity-50')}
          aria-busy={pending}
        >
          {data.questions.map((q, i) => (
            <OfficialQuestionCard
              key={`${q.id}:${resetKeys[q.id] ?? 0}`}
              question={q}
              index={firstIndex + i + 1}
              suuOpen={suuQuestion?.id === q.id}
              onSuu={(state) => setSuu(state ? { id: q.id, ...state } : null)}
              lastInTopic={i === data.questions.length - 1 && data.page === data.pageCount}
              onComplete={() => router.push('/bank')}
              onNext={() => {
                const next = data.questions[i + 1];
                if (!next) {
                  go({ page: data.page + 1 });
                  return;
                }
                setResetKeys((previous) => ({ ...previous, [next.id]: (previous[next.id] ?? 0) + 1 }));
                requestAnimationFrame(() => document.getElementById(`official-question-${next.id}`)?.focus());
              }}
            />
          ))}

          {data.questions.length === 0 && (
            <div className="rounded-3xl border border-dashed border-line-2 bg-paper p-10 text-center">
              <p className="font-bold text-ink">{t('bank.empty')}</p>
              <p className="mt-1 text-sm text-ink-3">{t('bank.emptyBody')}</p>
            </div>
          )}
        </section>

        {suu && suuQuestion && (
          <SuuSidePanel
            context={{
              kind: 'question',
              id: suuQuestion.id,
              title: suuQuestion.skill,
              problem: suuQuestion.text,
              chosen: suu.checked ? suu.chosen : undefined,
            }}
            revealed={suu.checked}
            onClose={() => setSuu(null)}
          />
        )}
      </div>

      {data.pageCount > 1 && (
        <nav aria-label={t('official.pagination')} className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={data.page <= 1 || pending}
            onClick={() => go({ page: data.page - 1 })}
            className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-bold text-ink enabled:hover:border-leaf disabled:opacity-40"
          >
            {t('official.prev')}
          </button>
          <span className="text-sm font-semibold text-ink-3 tnum">
            {t('official.pageOf', { page: data.page, pages: data.pageCount })}
          </span>
          <button
            type="button"
            disabled={data.page >= data.pageCount || pending}
            onClick={() => go({ page: data.page + 1 })}
            className="rounded-xl border border-line bg-paper px-4 py-2 text-sm font-bold text-ink enabled:hover:border-leaf disabled:opacity-40"
          >
            {t('official.next')}
          </button>
        </nav>
      )}

      <p className="px-1 text-center text-xs text-ink-3">{t('official.source')}</p>
    </div>
  );
}
