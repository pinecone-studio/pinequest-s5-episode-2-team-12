'use client';

import { useMemo, useState } from 'react';
import { Rich } from '@/components/math';
import { PageHeader } from '@/components/ui/PageHeader';
import { useT } from '@/lib/i18n-client';
import type { Domain, Question } from '@/types';
import { filterQuestions } from '../lib/filter-questions';

type Props = {
  questions: Question[];
  savedIds?: string[];
  hardOnly?: boolean;
  hideFilters?: boolean;
  onSelectQuestion?: (question: Question) => void;
};

const domains: { id: Domain | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'alg', label: 'Algebra' },
  { id: 'adv', label: 'Advanced Math' },
  { id: 'psda', label: 'PSDA' },
  { id: 'geo', label: 'Geometry' },
];

/* ───────── Shared look: tokens from globals.css (--c-*, .card) ───────── */

const card = 'section-panel';
const fieldLabel = 'eyebrow text-ink-3';
const field =
  'w-full rounded-2xl border border-line bg-paper-2 px-4 py-3 text-ink placeholder:text-sm placeholder:text-ink-3';
const chipBase = 'rounded-xl border px-4 py-2 text-xs font-bold transition';
const chipIdle = 'border-line bg-paper-2 text-ink-3 hover:border-leaf hover:text-ink';
const chipActive = 'border-leaf bg-leaf/10 text-leaf-2';

export function QuestionBank({
  questions,
  savedIds = [],
  hardOnly = false,
  hideFilters = false,
  onSelectQuestion,
}: Props) {
  const t = useT('practice');
  const [domain, setDomain] = useState<Domain | 'all'>('all');
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 'all'>(hardOnly ? 3 : 'all');
  const [desmosOnly, setDesmosOnly] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [search, setSearch] = useState('');

  const visibleQuestions = useMemo(
    () =>
      filterQuestions(questions, {
        domain: domain === 'all' ? undefined : domain,
        difficulty: hardOnly ? 3 : difficulty === 'all' ? undefined : difficulty,
        desmosOnly,
        savedOnly,
        savedIds,
        search,
      }),
    [questions, domain, difficulty, hardOnly, desmosOnly, savedOnly, savedIds, search],
  );

  return (
    <div className="workspace-page max-w-6xl text-ink">
      {!hardOnly && (
        <PageHeader title={t('pages.bank.title')} description={t('bank.lead')} icon="bank">
          <div className="rounded-2xl border border-line bg-paper px-5 py-3 text-right">
            <span className="block font-display text-2xl font-bold text-leaf-2 tnum">{questions.length}</span>
            <span className="text-xs font-semibold text-ink-3">{t('bank.available')}</span>
          </div>
        </PageHeader>
      )}

      {/* Filters */}
      {!hideFilters && (
        <section className={`${card} bank-filters space-y-5 p-5 sm:p-6`}>
          <div className="space-y-2.5">
            <h2 className={fieldLabel}>{t('bank.domain')}</h2>

            <nav className="flex flex-wrap gap-2" aria-label={t('bank.domainsLabel')}>
              {domains.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDomain(item.id)}
                  aria-pressed={domain === item.id}
                  className={`${chipBase} ${domain === item.id ? chipActive : chipIdle}`}
                >
                  {t(`bank.domains.${item.id}`)}
                </button>
              ))}
            </nav>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-2">
              <span className={fieldLabel}>{t('bank.search')}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('bank.searchPlaceholder')}
                className={field}
              />
            </label>

            {!hardOnly && (
              <label className="space-y-2">
                <span className={fieldLabel}>{t('bank.difficulty')}</span>
                <select
                  value={difficulty}
                  onChange={(event) =>
                    setDifficulty(
                      event.target.value === 'all' ? 'all' : (Number(event.target.value) as 1 | 2 | 3),
                    )
                  }
                  className={field}
                >
                  <option value="all">{t('bank.allDifficulties')}</option>
                  <option value="1">{t('bank.easy')}</option>
                  <option value="2">{t('bank.medium')}</option>
                  <option value="3">{t('bank.hard')}</option>
                </select>
              </label>
            )}

            <div className="flex flex-col justify-end gap-3 pb-2 text-sm text-ink-2">
              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={desmosOnly}
                  onChange={(event) => setDesmosOnly(event.target.checked)}
                  className="h-4 w-4 accent-(--c-leaf)"
                />
                {t('bank.desmosOnly')}
              </label>

              <label className="flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={savedOnly}
                  onChange={(event) => setSavedOnly(event.target.checked)}
                  className="h-4 w-4 accent-(--c-leaf)"
                />
                {t('bank.savedOnly')}
              </label>
            </div>
          </div>
        </section>
      )}

      <p className="px-1 text-sm text-ink-3" aria-live="polite">
        {t('bank.found', { n: visibleQuestions.length })}
      </p>

      {/* Questions */}
      <section className="bank-results space-y-4">
        {visibleQuestions.map((question) => (
          <article key={question.id} className={`${card} bank-question space-y-4`}>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-ink">{question.skill}</h2>

              <span className="rounded-full bg-paper-2 px-3 py-1 text-xs font-bold text-ink-3">
                {t('bank.difficultyBadge', { n: question.difficulty })}
              </span>

              {question.desmos && (
                <span className="rounded-full bg-teal-soft px-3 py-1 text-xs font-bold text-teal">
                  Desmos
                </span>
              )}
            </div>

            <div className="whitespace-pre-wrap text-[17px] font-medium leading-relaxed text-ink">
              <Rich text={question.prompt} />
            </div>

            {onSelectQuestion && (
              <button
                type="button"
                onClick={() => onSelectQuestion(question)}
                className="rounded-xl bg-leaf px-5 py-3 text-sm font-bold text-white"
                aria-label={`Бодох: ${question.skill}`}
              >
                Бодлого бодох
              </button>
            )}

            {question.choices && (
              <ol className="grid gap-2.5">
                {question.choices.map((choice, index) => (
                  <li
                    key={`${question.id}-${index}`}
                    className="flex items-center gap-3.5 rounded-2xl border border-line bg-paper-2 p-3.5 text-[15px] text-ink"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-xs font-bold text-ink-3">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <div className="flex-1">
                      <Rich text={choice} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </article>
        ))}

        {visibleQuestions.length === 0 && (
          <div className="rounded-3xl border border-dashed border-line-2 bg-paper p-10 text-center">
            <p className="font-bold text-ink">{t('bank.empty')}</p>
            <p className="mt-1 text-sm text-ink-3">{t('bank.emptyBody')}</p>
          </div>
        )}
      </section>
    </div>
  );
}
