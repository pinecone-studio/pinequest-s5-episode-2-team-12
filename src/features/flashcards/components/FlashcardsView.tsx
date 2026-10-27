
'use client';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Rich, Tex } from '@/components/math';
import { Button } from '@/components/ui/Button';
// /flashcards: today's queue (due reviews, then a few new cards), deck and topic filters, «for the current
// stop», and a study card: front → flip → back → Дахин / Хэцүү / Зүгээр / Амархан (SM-2, lib/sm2.ts).
// Space flips, 1–4 grade. Demo mode keeps the states in localStorage.
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
import { counts, type DeckId, FLASHCARDS, type FlashState, matches, queue } from '../lib/decks';

const KEY = 'suprep:flash:v1';

function readLocal(): Record<string, FlashState> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, FlashState>) : {};
  } catch {
    return {};
  }
}
function writeLocal(s: Record<string, FlashState>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage blocked: progress lasts for this visit
  }
}

const GRADE_STYLE: Record<Grade, string> = {
  again: 'border-danger/40 text-danger',
  hard: 'border-amber/40 text-amber',
  good: 'border-leaf/40 text-leaf-2',
  easy: 'border-teal/40 text-teal',
};

export function FlashcardsView({
  demo,
  serverStates,
  currentStop: serverStop,
  reviewed,
  initialTopic,
}: {
  demo: boolean;
  serverStates: Record<string, FlashState>;
  /** The student's current roadmap stop (= topic), when known on the server. */
  currentStop: number | null;
  /** Card keys an admin approved (besides `reviewed: true` in the JSON). */
  reviewed: string[];
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
    setCurrent(local.state.placement ? frontier(local.state.stops) : null);
  }, [demo]);

  const cards = useMemo(
    () => FLASHCARDS.filter((c) => matches(c, { deck: deck === 'all' ? undefined : deck, topicId })),
    [deck, topicId],
  );
  const q = useMemo(() => queue(cards, states, now), [cards, states, now]);
  const stats = counts(cards, states, now);
  const card = q[0];

  const grade = useCallback(
    async (g: Grade) => {
      if (!card) return;
      const at = Date.now();
      const prev = states[card.key];
      const next: FlashState = { ...review(prev ?? newState(at), g, at), first: prev?.first ?? at };
      const all = { ...states, [card.key]: next };
      setStates(all);
      setFlipped(false);
      setNow(at);
      if (demo) writeLocal(all);
      else {
        const r = await gradeFlashcard({ key: card.key, grade: g });
        if (r.ok) setStates((s) => ({ ...s, [card.key]: { ...r.state, first: next.first } }));
      }
    },
    [card, states, demo],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof Element && el.closest('input, select, textarea, button, [role="radio"]')) return;
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (flipped && ['1', '2', '3', '4'].includes(e.key)) void grade(GRADES[Number(e.key) - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flipped, grade]);

  const intervals = card ? preview(states[card.key] ?? newState(now), now) : null;
  const stop = current ? stopByNo(current) : null;

  // Reviewed logic
  const draft = card ? !card.reviewed && !approved.has(card.key) : false;

  return (
    <div className="workspace-page max-w-4xl">
      <PageHeader title={t('title')} description={t('lead')} icon="flashcards" />

      <dl className="grid grid-cols-3 gap-2">
        {(
          [
            ['due', stats.due],
            ['fresh', stats.fresh],
            ['learned', stats.learned],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="stat-card">
            <dt className="text-[12px] text-ink-3">{t(`stats.${k}`)}</dt>
            <dd className="font-display text-2xl font-bold text-ink tnum">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="filter-panel flex flex-wrap items-center gap-3">
        <SegmentedControl<DeckId | 'all'>
          label={t('title')}
          value={deck}
          onChange={(v) => {
            setDeck(v);
            setFlipped(false);
          }}
          options={[
            { value: 'all', label: t('decks.all') },
            { value: 'words', label: t('decks.words') },
            { value: 'formulas', label: t('decks.formulas') },
          ]}
        />
        <label className="sr-only" htmlFor={topicFieldId}>
          {t('topic')}
        </label>
        <select
          id={topicFieldId}
          value={topicId ?? ''}
          onChange={(e) => {
            setTopicId(e.target.value ? Number(e.target.value) : undefined);
            setFlipped(false);
          }}
          className="h-11 max-w-[220px] rounded-2xl border border-line bg-paper px-3 text-[14px] text-ink"
        >
          <option value="">{t('allTopics')}</option>
          {TOPICS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.id}. {x.title}
            </option>
          ))}
        </select>
        {stop && (
          <button
            type="button"
            aria-pressed={topicId === stop.no}
            onClick={() => setTopicId((v) => (v === stop.no ? undefined : stop.no))}
            className={cn(
              'h-11 rounded-2xl border px-3.5 text-[13px] font-bold',
              topicId === stop.no ? 'border-leaf bg-sage text-leaf-2' : 'border-line text-ink-2',
            )}
          >
            📍 {t('current', { place: stop.place })}
          </button>
        )}
      </div>

      {card ? (
        <section className="soft-card study-card grid gap-6 p-6 sm:p-8" aria-live="polite">
          <div className="flex items-center justify-between gap-2 text-[12px] text-ink-3">
            <span>{card.group}</span>
            <span className="flex items-center gap-2">
              {draft && <Pill tone="amber">{t('draft')}</Pill>}
              <span>{t('left', { n: q.length })}</span>
            </span>
          </div>
          <div className="grid min-h-[200px] place-items-center text-center">
            <div className="grid gap-2">
              <p className="font-display text-[30px] font-bold leading-tight text-ink">{card.front}</p>
              {card.ipa && !flipped && <p className="text-[14px] text-ink-3">{card.ipa}</p>}
              {flipped && (
                <div className="grid gap-3 text-[15px] text-ink-2">
                  <p className="text-[20px] font-bold text-leaf-2">{card.back}</p>
                  {card.say && <p className="text-ink-3">[{card.say}]</p>}
                  {card.tex && (
                    <div className="overflow-x-auto rounded-xl border border-line bg-paper px-3 py-2">
                      <Tex tex={card.tex} display />
                    </div>
                  )}
                  {card.when && (
                    <p>
                      <span className="font-semibold text-ink">{t('when')}: </span>
                      <Rich text={card.when} />
                    </p>
                  )}
                  {card.ex && (
                    <p>
                      <span className="font-semibold text-ink">{t('example')}: </span>
                      <Rich text={card.ex} />
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          {!flipped ? (
            <Button size="lg" onClick={() => setFlipped(true)} className="w-full">
              {t('show')}
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GRADES.map((g, i) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => grade(g)}
                  className={cn(
                    'grid h-14 place-items-center rounded-2xl border-[1.5px] bg-paper font-bold',
                    GRADE_STYLE[g],
                  )}
                >
                  <span>
                    <span className="sr-only">{i + 1}. </span>
                    {t(`grades.${g}`)}
                  </span>
                  <span className="text-[11.5px] font-semibold text-ink-3">
                    {intervals && intervals[g] === 0
                      ? t('in.min', { n: 10 })
                      : t('in.day', { n: intervals?.[g] ?? 1 })}
                  </span>
                </button>
              ))}
            </div>
          )}
          <p className="hidden text-center text-[11.5px] text-ink-3 md:block">{t('keys')}</p>
        </section>
      ) : (
        <section className="soft-card grid justify-items-center gap-2 p-8 text-center">
          <p className="font-display text-xl font-bold text-ink">{t('done')}</p>
          <p className="text-[14px] text-ink-2">{t('doneBody')}</p>
        </section>
      )}
    </div>
  );
}
