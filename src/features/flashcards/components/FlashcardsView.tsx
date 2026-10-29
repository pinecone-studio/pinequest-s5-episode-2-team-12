
'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Rich, Tex } from '@/components/math';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pill } from '@/components/ui/Pill';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { loadLocalRoadmap } from '@/features/roadmap/lib/local-store';
import { frontier } from '@/features/roadmap/lib/unlock';
import { stopByNo } from '@/features/roadmap/stops';
import { TOPICS } from '@/features/roadmap/topics';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { GRADES, type Grade, newState, preview, review } from '@/lib/sm2';
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
  hard:
    'border-[#D9C18E] bg-[#E9D8B4] text-[#78613A] hover:border-[#D9C18E] hover:bg-[#DFCCA1] hover:text-[#6D552F] focus-visible:ring-[#D9C18E]',
  good:
    'border-[#9FC6AE] bg-[#C4DFCD] text-[#3F6B50] hover:border-[#9FC6AE] hover:bg-[#B3D4BF] hover:text-[#345D43] focus-visible:ring-[#9FC6AE]',
  easy:
    'border-[#9FCBD4] bg-[#C3E0E6] text-[#3D6973] hover:border-[#9FCBD4] hover:bg-[#B0D5DD] hover:text-[#315C66] focus-visible:ring-[#9FCBD4]',
};

/** Each card gets a consistent color on both sides. */
const CARD_THEMES = [
  {
    border: 'border-[#496F55]',
    bg: 'bg-[#365B43]',
    badge: 'bg-[#587D63] text-[#E8F0E9]',
  },
];

export function FlashcardsView({
  demo,
  serverStates,
  currentStop: serverStop,
  reviewed,
  extra = [],
  initialTopic,
}: {
  demo: boolean;
  serverStates: Record<string, FlashState>;
  currentStop: number | null;
  reviewed: string[];
  /** Admin-written word cards (custom_cards), after the bundled decks. */
  extra?: FlashCard[];
  initialTopic?: number;
}) {
  const t = useT('flashcards');

  const [states, setStates] = useState(serverStates);
  const [deck, setDeck] = useState<DeckId | 'all'>('all');
  const [topicId, setTopicId] = useState<number | undefined>(initialTopic);
  const [current, setCurrent] = useState(serverStop);
  const [flipped, setFlipped] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const approved = useMemo(() => new Set(reviewed), [reviewed]);
  const topicFieldId = useId();

  useEffect(() => {
    if (!demo) return;

    setStates(readLocal());

    const local = loadLocalRoadmap();
    setCurrent(
      local.state.placement ? frontier(local.state.stops) : null,
    );
  }, [demo]);

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

  const q = useMemo(
    () => queue(cards, states, now),
    [cards, states, now],
  );

  const stats = counts(cards, states, now);
  const card = q[0];

  const currentTheme = useMemo(() => {
    if (!card) return CARD_THEMES[0];

    let hash = 0;

    for (let i = 0; i < card.key.length; i++) {
      hash = card.key.charCodeAt(i) + ((hash << 5) - hash);
    }

    return CARD_THEMES[Math.abs(hash) % CARD_THEMES.length];
  }, [card]);

  const grade = useCallback(
    async (g: Grade) => {
      if (!card) return;

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

      setStates(updatedStates);
      setFlipped(false);
      setNow(at);

      if (demo) {
        writeLocal(updatedStates);
        return;
      }

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
    [card, states, demo],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;

      if (
        target instanceof Element &&
        target.closest(
          'input, select, textarea, button, [role="radio"], [contenteditable="true"]',
        )
      ) {
        return;
      }

      if (event.code === 'Space' && card) {
        event.preventDefault();
        setFlipped((value) => !value);
        return;
      }

      if (flipped && ['1', '2', '3', '4'].includes(event.key)) {
        void grade(GRADES[Number(event.key) - 1]);
      }
    };

    window.addEventListener('keydown', onKey);

    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [card, flipped, grade]);

  const intervals = card
    ? preview(states[card.key] ?? newState(now), now)
    : null;

  const stop = current ? stopByNo(current) : null;

  const cardReviewed =
    card !== undefined &&
    'reviewed' in card &&
    card.reviewed === true;

  const draft = Boolean(
    card && !cardReviewed && !approved.has(card.key),
  );

  return (
    <div className="workspace-page mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <PageHeader
        title={t('title')}
        description={t('lead')}
        icon="flashcards"
      />

      {/* Progress overview */}
      <dl className="grid grid-cols-3 gap-3">
        {(
          [
            ['due', stats.due],
            ['fresh', stats.fresh],
            ['learned', stats.learned],
          ] as const
        ).map(([key, value]) => (
          <div
            key={key}
            className="rounded-xl border border-line/60 bg-paper p-4 transition-all hover:border-line"
          >
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">
              {t(`stats.${key}`)}
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">
              {value}
            </dd>
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
                setTopicId((value) =>
                  value === stop.no ? undefined : stop.no,
                );
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

      {/* 3D flashcard */}
      {card ? (
        <section className="space-y-6">
          <div
            className="relative h-[340px] w-full cursor-pointer [perspective:1000px] sm:h-[380px]"
            role="button"
            tabIndex={0}
            aria-pressed={flipped}
            onClick={() => setFlipped((previous) => !previous)}
            // Space already flips through the page-wide shortcut above
            onKeyDown={(event) => {
              if (event.key === 'Enter') setFlipped((previous) => !previous);
            }}
          >
            <div
              className={cn(
                'relative h-full w-full rounded-2xl shadow-md',
                'transition-transform duration-500 [transform-style:preserve-3d]',
                flipped ? '[transform:rotateY(180deg)]' : '',
              )}
            >
              {/* Front side */}
              <div
                aria-hidden={flipped}
                className={cn(
                  'absolute inset-0 flex h-full w-full flex-col justify-between',
                  'rounded-2xl border-2 p-6 sm:p-8',
                  '[backface-visibility:hidden]',
                  'transition-colors duration-200',
                  currentTheme.border,
                  currentTheme.bg,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px]',
                      'font-semibold uppercase tracking-wider',
                      currentTheme.badge,
                    )}
                  >
                    {card.group} • Word
                  </span>

                  <div className="flex items-center gap-2">
                    {draft && <Pill tone="amber">{t('draft')}</Pill>}

                    <span className="rounded-full border border-white/15 bg-black/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                      {t('left', { n: q.length })}
                    </span>
                  </div>
                </div>

                <div className="my-auto space-y-3 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-white/80">
                    Click or Press Space to Flip
                  </span>

                  <h2 className="break-words font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    {card.front}
                  </h2>

                  {card.ipa && (
                    <p className="text-sm font-medium text-white/80">
                      {card.ipa}
                    </p>
                  )}
                </div>

                <div className="text-center text-[11px] font-semibold text-white/80">
                  Minimal Flashcard
                </div>
              </div>

              {/* Back side */}
              <div
                aria-hidden={!flipped}
                className={cn(
                  'absolute inset-0 flex h-full w-full flex-col justify-between',
                  'overflow-y-auto rounded-2xl border-2 p-6 sm:p-8',
                  // <Rich> bolds in ink; on the dark card it has to stay light
                  '[&_strong]:text-white',
                  '[backface-visibility:hidden] [transform:rotateY(180deg)]',
                  currentTheme.border,
                  currentTheme.bg,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px]',
                      'font-semibold uppercase tracking-wider',
                      currentTheme.badge,
                    )}
                  >
                    {card.group} • Meaning
                  </span>

                  <span className="rounded-full border border-white/15 bg-black/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {t('left', { n: q.length })}
                  </span>
                </div>

                <div className="my-auto space-y-3 py-4 text-center">
                  <p className="break-words font-display text-xl font-bold text-white sm:text-2xl">
                    {card.back}
                  </p>

                  {card.say && (
                    <p className="text-xs font-medium text-white/80">
                      [{card.say}]
                    </p>
                  )}

                  {card.tex && (
                    <div className="overflow-x-auto rounded-lg border border-white/20 bg-white/90 p-2 text-[#132f28]">
                      <Tex tex={card.tex} display />
                    </div>
                  )}

                  {card.when && (
                    <p className="text-xs font-medium text-white">
                      <span className="font-bold">{t('when')}: </span>
                      <Rich text={card.when} />
                    </p>
                  )}

                  {card.ex && (
                    <p className="text-xs font-medium text-white">
                      <span className="font-bold">{t('example')}: </span>
                      <Rich text={card.ex} />
                    </p>
                  )}
                </div>

                <div className="text-center text-[11px] font-semibold text-white/80">
                  Minimal Flashcard
                </div>
              </div>
            </div>
          </div>

          {/* Grade options */}
          {!flipped ? (
            <div className="space-y-2">
              <Button
                size="lg"
                onClick={() => setFlipped(true)}
                className="w-full"
              >
                {t('show')} (Flip Card)
              </Button>

              <p className="text-center text-[11px] text-ink-3">
                {t('keys')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-center text-[11px] font-medium text-ink-3">
                {t('keys')}
              </p>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GRADES.map((gradeValue, index) => (
                  <button
                    key={gradeValue}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void grade(gradeValue);
                    }}
                    className={cn(
                      'flex min-h-[64px] flex-col items-center justify-center',
                      'gap-1 rounded-xl border-2 px-2 py-2',
                      'font-semibold shadow-sm transition-all duration-200',
                      'hover:-translate-y-0.5 hover:shadow-md',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                      GRADE_STYLE[gradeValue],
                    )}
                  >
                    <span className="text-xs font-semibold">
                      <span className="sr-only">{index + 1}. </span>
                      {t(`grades.${gradeValue}`)}
                    </span>

                    <span className="text-[10px] opacity-80">
                      {intervals && intervals[gradeValue] === 0
                        ? t('in.min', { n: 10 })
                        : t('in.day', {
                            n: intervals?.[gradeValue] ?? 1,
                          })}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-line/60 bg-paper px-6 py-12 text-center">
          <div className="grid size-12 place-items-center rounded-xl bg-sage text-xl text-leaf-2">
            ✓
          </div>

          <h2 className="font-display text-lg font-bold text-ink">
            {t('done')}
          </h2>

          <p className="max-w-sm text-xs text-ink-2">
            {t('doneBody')}
          </p>
        </section>
      )}
    </div>
  );
}
