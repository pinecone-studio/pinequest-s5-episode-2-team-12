'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Rich, Tex } from '@/components/math';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DownloadCards } from '@/features/offline/DownloadCards';
import { loadLocalRoadmap } from '@/features/roadmap/lib/local-store';
import { frontier } from '@/features/roadmap/lib/unlock';
import { stopByNo } from '@/features/roadmap/stops';
import { TOPICS } from '@/features/roadmap/topics';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { type Grade, newState, review } from '@/lib/sm2';
import { gradeFlashcard } from '../actions';
import {
  counts,
  type DeckId,
  FLASHCARDS,
  type FlashCard,
  type FlashState,
  matches,
  queue,
} from '../lib/decks';

const KEY = 'suprep:flash:v1';
const STUDY_GRADES: Grade[] = ['again', 'good'];
type StudySection = 'today' | 'repeat' | 'learned';
const needsRepeat = (state?: FlashState) => Boolean(state && state.reps === 0 && state.lapses > 0);

function readLocal(): Record<string, FlashState> {
  try {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, FlashState>) : {};
  } catch {
    return {};
  }
}

function writeLocal(states: Record<string, FlashState>) {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify(states));
  } catch {}
}

/** Grade buttons use their own stronger color on hover and keyboard focus. */
const GRADE_STYLE: Record<Grade, string> = {
  again:
    'border-[#D6A0A9] bg-[#E8C1C7] text-[#78434B] hover:border-[#D6A0A9] hover:bg-[#DDB0B7] hover:text-[#6E3740] focus-visible:ring-[#D6A0A9]',
  hard: 'border-[#D9C18E] bg-[#E9D8B4] text-[#78613A] hover:border-[#D9C18E] hover:bg-[#DFCCA1] hover:text-[#6D552F] focus-visible:ring-[#D9C18E]',
  good: 'border-[#9FC6AE] bg-[#C4DFCD] text-[#3F6B50] hover:border-[#9FC6AE] hover:bg-[#B3D4BF] hover:text-[#345D43] focus-visible:ring-[#9FC6AE]',
  easy: 'border-[#9FCBD4] bg-[#C3E0E6] text-[#3D6973] hover:border-[#9FCBD4] hover:bg-[#B0D5DD] hover:text-[#315C66] focus-visible:ring-[#9FCBD4]',
};

export function FlashcardsView({
  demo,
  serverStates,
  currentStop: serverStop,
  reviewed,
  extra = [],
  initialTopic,
  onGrade,
}: {
  demo: boolean;
  serverStates: Record<string, FlashState>;
  currentStop: number | null;
  reviewed: string[];
  /** Admin-written word cards (custom_cards), after the bundled decks. */
  extra?: FlashCard[];
  initialTopic?: number;
  /** /offline/flashcards: keeps grades on the device instead of calling the server. */
  onGrade?: (key: string, grade: Grade, at: number, next: FlashState) => void;
}) {
  const t = useT('flashcards');

  const [states, setStates] = useState(serverStates);
  const [deck, setDeck] = useState<DeckId | 'all'>('all');
  const [topicId, setTopicId] = useState<number | undefined>(initialTopic);
  const [current, setCurrent] = useState(serverStop);
  const [flipped, setFlipped] = useState(false);
  const [started, setStarted] = useState(false);
  const [studySection, setStudySection] = useState<StudySection>('today');
  const [sessionSeen, setSessionSeen] = useState<string[]>([]);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const studyCard = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  const approved = useMemo(() => new Set(reviewed), [reviewed]);
  const topicFieldId = useId();

  useEffect(() => {
    if (!demo) return;

    if (!onGrade) setStates(readLocal());

    const local = loadLocalRoadmap();
    setCurrent(local.state.placement ? frontier(local.state.stops) : null);
  }, [demo, onGrade]);

  const cards = useMemo(
    () =>
      [...FLASHCARDS, ...extra].filter((item) =>
        matches(item, {
          deck: deck === 'all' ? undefined : deck,
          topicId,
        }),
      ),
    [deck, topicId, extra],
  );

  const repeatCards = cards.filter((item) => needsRepeat(states[item.key]));
  const learnedCards = cards.filter((item) => (states[item.key]?.reps ?? 0) > 0);
  const q = useMemo(() => {
    const selected =
      studySection === 'repeat'
        ? cards.filter((item) => needsRepeat(states[item.key]))
        : studySection === 'learned'
          ? cards.filter((item) => (states[item.key]?.reps ?? 0) > 0)
          : queue(cards, states, now);
    return selected.filter((item) => !sessionSeen.includes(item.key));
  }, [cards, states, now, studySection, sessionSeen]);

  const stats = counts(cards, states, now);
  const card = q[0];

  useEffect(() => {
    if (started && card) studyCard.current?.focus();
  }, [started, card]);

  const grade = useCallback(
    async (g: Grade) => {
      if (!started || !flipped || !card) return;

      const at = Date.now();
      const previous = states[card.key];

      const next: FlashState = {
        ...review(previous ?? newState(at), g, at),
        first: previous?.first ?? at,
      };

      const updatedStates = {
        ...states,
        [card.key]: next,
      };

      setSessionSeen((keys) => [...keys, card.key]);
      setSessionReviewed((value) => value + 1);
      setStates(updatedStates);
      setFlipped(false);
      setNow(at);

      onGrade?.(card.key, g, at, next);

      if (demo) {
        writeLocal(updatedStates);
        return;
      }

      if (onGrade) return;

      try {
        const result = await gradeFlashcard({
          key: card.key,
          grade: g,
        });

        if (result.ok) {
          setStates((currentStates) => ({
            ...currentStates,
            [card.key]: {
              ...result.state,
              first: next.first,
            },
          }));
        }
      } catch {
        // Keep the optimistic UI state if the request fails.
      }
    },
    [card, states, demo, onGrade, started, flipped],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!started) return;
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest('input, select, textarea, button, [role="radio"], [contenteditable="true"]')
      ) {
        return;
      }

      if (event.code === 'Space' && card) {
        event.preventDefault();
        setFlipped((value) => !value);
        return;
      }

      if (flipped && ['1', '2'].includes(event.key)) {
        void grade(STUDY_GRADES[Number(event.key) - 1]);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [card, flipped, grade, started]);

  const stop = current ? stopByNo(current) : null;

  const cardReviewed = card !== undefined && 'reviewed' in card && card.reviewed === true;

  const draft = Boolean(card && !cardReviewed && !approved.has(card.key));

  return (
    <div className="workspace-page mx-auto w-full max-w-3xl gap-5 px-4 py-6">
      <PageHeader title={t('title')} description={t('lead')} icon="flashcards" />

      {/* Progress overview */}
      <dl className="grid grid-cols-3 gap-3">
        {(
          [
            ['due', repeatCards.length],
            ['fresh', stats.fresh],
            ['learned', learnedCards.length],
          ] as const
        ).map(([key, value]) => (
          <div
            key={key}
            className="rounded-xl border border-line/60 bg-paper p-4 transition-all hover:border-line"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              {t(`stats.${key}`)}
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      {/* Deck and topic filters */}
      <section
        aria-label={t('topic')}
        className="flex flex-col gap-3 rounded-xl border border-line/60 bg-paper p-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <SegmentedControl<DeckId | 'all'>
            label={t('title')}
            value={deck}
            onChange={(value) => {
              setSessionSeen([]);
              setStarted(false);
              setDeck(value);
              setFlipped(false);
            }}
            options={[
              { value: 'all', label: t('decks.all') },
              { value: 'words', label: t('decks.words') },
              { value: 'formulas', label: t('decks.formulas') },
            ]}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={topicFieldId}>
            {t('topic')}
          </label>

          <select
            id={topicFieldId}
            value={topicId ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              setSessionSeen([]);
              setStarted(false);
              setTopicId(value ? Number(value) : undefined);
              setFlipped(false);
            }}
            className="h-9 w-full rounded-lg border border-line/80 bg-paper px-3 text-xs text-ink outline-none transition-all focus:border-leaf sm:w-auto"
          >
            <option value="">{t('allTopics')}</option>

            {TOPICS.map((topic) => (
              <option key={topic.id} value={topic.id}>
                {topic.id}. {topic.title}
              </option>
            ))}
          </select>

          {stop && (
            <button
              type="button"
              aria-pressed={topicId === stop.no}
              onClick={() => {
                setSessionSeen([]);
                setStarted(false);
                setTopicId((value) => (value === stop.no ? undefined : stop.no));
                setFlipped(false);
              }}
              className={cn(
                'h-9 shrink-0 rounded-lg border px-3 text-xs font-medium transition-all',
                topicId === stop.no
                  ? 'border-leaf bg-sage text-leaf-2'
                  : 'border-line/80 bg-paper text-ink-2 hover:bg-sage/40',
              )}
            >
              📍 {stop.place}
            </button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3" role="group" aria-label={t('sections.label')}>
        {(['today', 'repeat', 'learned'] as const).map((section) => {
          const total =
            section === 'repeat'
              ? repeatCards.length
              : section === 'learned'
                ? learnedCards.length
                : queue(cards, states, now).length;
          return (
            <button
              key={section}
              type="button"
              aria-label={`${t(`sections.${section}`)}${section === 'today' ? '' : ` (${total})`}`}
              aria-pressed={studySection === section}
              onClick={() => {
                setStudySection(section);
                setStarted(false);
                setSessionSeen([]);
                setFlipped(false);
              }}
              className={cn(
                'group flex min-h-[140px] min-w-0 flex-col justify-between gap-4 rounded-2xl border-2 p-3 text-left text-[#174e35] transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-leaf sm:p-5',
                studySection === section ? 'border-[#3c794e] bg-[#e0efda]' : 'border-[#c5dabc] bg-[#eef7e9]',
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span aria-hidden="true" className="relative inline-grid size-10 shrink-0 place-items-center">
                  <span className="absolute left-2 top-0 size-8 rounded-md border border-[#7fa573] bg-[#d6e9cc]" />
                  <span className="absolute left-1 top-1 size-8 rounded-md border border-[#7fa573] bg-[#e2efdc]" />
                  <span className="absolute left-0 top-2 grid size-8 place-items-center rounded-md border-2 border-[#6e9866] bg-[#f9fcf5] text-base font-bold">
                    {section === 'repeat' ? '↻' : section === 'learned' ? '✓' : '+'}
                  </span>
                </span>
                <span className="font-display text-2xl font-bold tnum sm:text-3xl">{total}</span>
              </span>
              <span className="text-xs font-bold leading-snug sm:text-sm">{t(`sections.${section}`)}</span>
            </button>
          );
        })}
      </div>

      {!started ? (
        <section className="soft-card relative overflow-hidden border border-line p-6 sm:p-8">
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="grid gap-3">
              <p className="text-xs font-bold uppercase tracking-wider text-leaf-2">{t('session.eyebrow')}</p>
              <h2 className="font-display text-2xl font-bold text-ink">
                {t(
                  studySection === 'repeat'
                    ? 'sections.repeat'
                    : studySection === 'learned'
                      ? 'sections.learned'
                      : 'session.ready',
                )}
              </h2>
              <p className="max-w-md text-sm leading-relaxed text-ink-2">
                {t(
                  studySection === 'repeat'
                    ? 'sections.repeatIntro'
                    : studySection === 'learned'
                      ? 'sections.learnedIntro'
                      : 'session.intro',
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Pill tone="teal">{t('session.count', { n: q.length })}</Pill>
                <Pill>{t(`decks.${deck}`)}</Pill>
              </div>
            </div>
            <div
              aria-hidden="true"
              className="hidden sm:grid size-28 rotate-6 place-content-center rounded-3xl border-2 border-line bg-sage shadow-sm"
            >
              <span className="font-display text-4xl font-bold text-leaf-2">Aa</span>
              <span className="mt-1 text-center text-xs font-semibold text-leaf-2">SAT Math</span>
            </div>
          </div>
          <ol className="my-6 grid gap-3 border-y border-line py-5 sm:grid-cols-3">
            {['recall', 'reveal', 'rate'].map((key, index) => (
              <li key={key} className="flex items-center gap-2.5 text-sm text-ink-2">
                <span className="grid size-7 shrink-0 place-content-center rounded-full bg-sage text-xs font-bold text-leaf-2">
                  {index + 1}
                </span>
                {t(`session.${key}`)}
              </li>
            ))}
          </ol>
          <Button
            size="lg"
            disabled={!card}
            onClick={() => {
              setSessionSeen([]);
              setSessionReviewed(0);
              setFlipped(false);
              setNow(Date.now());
              setStarted(true);
            }}
            className="w-full sm:w-auto"
          >
            {t('session.start')} <span aria-hidden="true">→</span>
          </Button>
          {!card && (
            <p className="mt-3 text-sm text-ink-3">
              {t(studySection === 'repeat' ? 'sections.repeatEmpty' : 'doneBody')}
            </p>
          )}
        </section>
      ) : card ? (
        <section className="grid gap-4" aria-label={t('session.study')}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="font-semibold text-ink">
              {t('session.reviewed', { n: sessionReviewed })}{' '}
              <span className="ml-2 font-normal text-ink-3">· {t('left', { n: q.length })}</span>
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSessionSeen([]);
                setStarted(false);
                setFlipped(false);
              }}
            >
              {t('session.finish')}
            </Button>
          </div>
          <progress
            max={sessionReviewed + q.length}
            value={sessionReviewed}
            aria-label={t('session.progress')}
            className="h-1.5 w-full overflow-hidden rounded-full accent-(--c-leaf)"
          />
          <div
            ref={studyCard}
            role="button"
            tabIndex={0}
            aria-label={t('flip')}
            aria-pressed={flipped}
            onClick={() => setFlipped((value) => !value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.code === 'Space') {
                event.preventDefault();
                event.stopPropagation();
                setFlipped((value) => !value);
              }
            }}
            className={cn(
              'grid min-h-[280px] cursor-pointer content-between gap-6 rounded-3xl border p-6 shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-leaf focus-visible:ring-offset-4 sm:min-h-[300px] sm:p-8',
              flipped ? 'border-line bg-paper text-ink' : 'border-[#17594a] bg-[#0b3b30] text-white',
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold',
                  flipped ? 'bg-sage text-leaf-2' : 'bg-white/10 text-white/90',
                )}
              >
                {card.group} · {t(card.deck === 'formulas' ? 'decks.formulas' : 'decks.words')}
              </span>
              <span className={cn('text-xs font-semibold', flipped ? 'text-leaf-2' : 'text-white/70')}>
                {t(flipped ? 'session.answer' : 'session.question')}
              </span>
            </div>
            <div className="grid gap-4 py-4 text-center" aria-live="polite">
              {!flipped ? (
                <>
                  <h2 className="break-words font-display text-3xl font-bold tracking-tight sm:text-4xl">
                    {card.front}
                  </h2>
                  {card.ipa && <p className="text-base text-white/75">{card.ipa}</p>}
                </>
              ) : (
                <>
                  <h2 className="break-words font-display text-2xl font-bold text-ink sm:text-3xl">
                    {card.back}
                  </h2>
                  {card.say && <p className="text-sm text-ink-2">[{card.say}]</p>}
                  {card.tex && (
                    <div className="overflow-x-auto rounded-xl bg-paper-2 p-3">
                      <Tex tex={card.tex} display />
                    </div>
                  )}
                  {card.when && (
                    <p className="text-sm leading-relaxed text-ink-2">
                      <strong>{t('when')}: </strong>
                      <Rich text={card.when} />
                    </p>
                  )}
                  {card.ex && (
                    <p className="text-sm leading-relaxed text-ink-2">
                      <strong>{t('example')}: </strong>
                      <Rich text={card.ex} />
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              {draft ? <Pill tone="amber">{t('draft')}</Pill> : <span />}
              <p className={cn('text-xs', flipped ? 'text-ink-3' : 'text-white/65')}>
                {t('session.flipHint')}
              </p>
            </div>
          </div>
          {!flipped ? (
            <Button size="lg" onClick={() => setFlipped(true)} className="w-full">
              {t('show')}
            </Button>
          ) : (
            <div className="grid gap-3">
              <p className="text-center text-sm font-semibold text-ink-2">{t('session.ratePrompt')}</p>
              <div className="grid grid-cols-2 gap-3">
                {STUDY_GRADES.map((gradeValue, index) => (
                  <button
                    key={gradeValue}
                    type="button"
                    onClick={() => void grade(gradeValue)}
                    className={cn(
                      'grid min-h-[68px] content-center justify-items-center gap-1 rounded-2xl border px-3 py-3 font-semibold transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf',
                      GRADE_STYLE[gradeValue],
                    )}
                  >
                    <span className="text-sm">
                      <span className="sr-only">{index + 1}. </span>
                      {t(gradeValue === 'again' ? 'sections.repeat' : 'sections.learned')}
                    </span>
                    <span className="text-xs opacity-80">
                      {t(gradeValue === 'again' ? 'sections.keep' : 'sections.remove')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-center text-xs text-ink-3">{t('keys')}</p>
        </section>
      ) : (
        <section className="soft-card grid justify-items-center gap-4 p-8 text-center">
          <span
            className="grid size-14 place-items-center rounded-full bg-sage text-2xl text-leaf-2"
            aria-hidden="true"
          >
            ✓
          </span>
          <h2 className="font-display text-xl font-bold text-ink">{t('done')}</h2>
          <p className="text-sm text-ink-2">{t('session.reviewed', { n: sessionReviewed })}</p>
          <p className="max-w-sm text-sm text-ink-3">{t('doneBody')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setSessionSeen([]);
              setStarted(false);
            }}
          >
            {t('session.back')}
          </Button>
        </section>
      )}
      {!started && studySection === 'repeat' && repeatCards.length > 0 && (
        <section className="soft-card grid gap-3 p-5" aria-label={t('sections.saved')}>
          <h2 className="font-bold text-ink">{t('sections.saved')}</h2>
          <ul className="divide-y divide-line">
            {repeatCards.map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3 py-3">
                <span className="font-semibold text-ink">{item.front}</span>
                <span className="text-xs text-ink-3">{item.group}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {!onGrade && (
        <details className="rounded-2xl border border-line bg-paper p-4">
          <summary className="cursor-pointer text-sm font-semibold text-ink-2">
            {t('session.offline')}
          </summary>
          <div className="mt-3">
            <DownloadCards states={states} extra={extra} reviewed={reviewed} currentStop={current} />
          </div>
        </details>
      )}
    </div>
  );
}
