'use client';
// Pitch demo · /planner — the student enters exam date, scores and time; Суу returns a study plan.
// Phase lengths are computed (lib/demo-plan.ts); the week schedule is a labelled sample.
import Link from 'next/link';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { usePlacementWeak } from '@/features/roadmap/components/placement-weak';
import type { RoadmapState } from '@/features/roadmap/types';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { dayKey } from '@/lib/time';
import { buildPlan, type DemoPlan, type Phase, WEAK_TOPICS, WEEK } from '../lib/demo-plan';

type SatDate = { d: string; reg: string; late: string };

const field =
  'h-11 w-full rounded-xl border border-line bg-paper px-3 text-[15px] text-ink outline-none focus:border-leaf';

export function PlannerDemo({
  dates,
  phases,
  roadmap = { demo: true, server: null, ids: [] },
}: {
  dates: SatDate[];
  phases: Phase[];
  /** Placement result → weak topics («Монголын аялал»). */
  roadmap?: { demo: boolean; server: RoadmapState | null; ids: number[] };
}) {
  const t = useT('planner');
  const today = dayKey();
  const upcoming = dates.filter((d) => d.d > today);
  const [examDate, setExamDate] = useState(upcoming[1]?.d ?? upcoming[0]?.d ?? dates[dates.length - 1]?.d);
  const [current, setCurrent] = useState(600);
  const [target, setTarget] = useState(750);
  const [hours, setHours] = useState(1.5);
  const placementWeak = usePlacementWeak(roadmap);
  const topics = [...placementWeak, ...WEAK_TOPICS.filter((x) => !placementWeak.includes(x))];
  const [weak, setWeak] = useState<string[]>([WEAK_TOPICS[1], WEAK_TOPICS[2]]);
  const fromPlacement = placementWeak.join('|');
  // the placement result arrives after mount in demo mode (localStorage)
  useEffect(() => {
    if (fromPlacement) setWeak(fromPlacement.split('|'));
  }, [fromPlacement]);
  const [plan, setPlan] = useState<DemoPlan | null>(null);
  const [thinking, setThinking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function toggle(topic: string) {
    setWeak((w) => (w.includes(topic) ? w.filter((x) => x !== topic) : [...w, topic]));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPlan(null);
    setThinking(true);
    timer.current = setTimeout(() => {
      setPlan(buildPlan({ examDate, today, current, target, hoursPerDay: hours }, phases));
      setThinking(false);
    }, 1300);
  }

  const weakText = weak.length ? weak.join(', ') : WEAK_TOPICS[0];

  return (
    <section className="grid gap-5">
      <header>
        <div className="eyebrow mb-2">{t('demo.eyebrow')}</div>
        <h1 className="font-display font-extrabold text-[26px] md:text-[34px] leading-tight text-ink">
          {t('pages.planner.title')}
        </h1>
        <p className="mt-1 text-[15px] text-ink-2">{t('demo.subtitle')}</p>
      </header>

      <form onSubmit={onSubmit} className="soft-card grid gap-4 p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1.5 text-[13.5px] font-semibold text-ink-2">
            {t('demo.examDate')}
            <select className={field} value={examDate} onChange={(e) => setExamDate(e.target.value)}>
              {(upcoming.length ? upcoming : dates).map((d) => (
                <option key={d.d} value={d.d}>
                  {d.d}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-[13.5px] font-semibold text-ink-2">
            {t('demo.current')}
            <input
              className={field}
              type="number"
              min={200}
              max={800}
              step={10}
              value={current}
              onChange={(e) => setCurrent(Number(e.target.value))}
            />
          </label>
          <label className="grid gap-1.5 text-[13.5px] font-semibold text-ink-2">
            {t('demo.target')}
            <input
              className={field}
              type="number"
              min={200}
              max={800}
              step={10}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
          </label>
          <label className="grid gap-1.5 text-[13.5px] font-semibold text-ink-2">
            {t('demo.hours')}
            <input
              className={field}
              type="number"
              min={0.5}
              max={6}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
            />
          </label>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1.5 text-[13.5px] font-semibold text-ink-2">{t('demo.weak')}</legend>
          <div className="flex flex-wrap gap-2">
            {topics.map((topic) => (
              <button
                key={topic}
                type="button"
                aria-pressed={weak.includes(topic)}
                onClick={() => toggle(topic)}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors',
                  weak.includes(topic)
                    ? 'border-leaf bg-sage text-leaf-2'
                    : 'border-line bg-paper text-ink-2 hover:bg-paper-2',
                )}
              >
                {topic}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <Button type="submit" size="lg" disabled={thinking || !examDate}>
            {t('demo.make')}
          </Button>
        </div>
      </form>

      {thinking && (
        <p className="animate-pulse text-[15px] text-ink-3" role="status">
          {t('demo.thinking')}
        </p>
      )}

      {plan && (
        <div className="grid gap-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="amber">{t('demo.sample')}</Pill>
            <span className="text-[14px] text-ink-3">{t('demo.forDate', { date: examDate })}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [t('demo.weeksLeft'), String(plan.weeks)],
              [t('demo.totalHours'), String(plan.totalHours)],
              [t('demo.gain'), `+${plan.gain}`],
            ].map(([label, value]) => (
              <div key={label} className="soft-card p-4">
                <div className="text-[13px] font-semibold text-ink-3">{label}</div>
                <div className="font-display text-[30px] font-extrabold text-ink">{value}</div>
              </div>
            ))}
          </div>

          <div className="soft-card p-4 md:p-5">
            <h2 className="mb-3 font-display text-[19px] font-bold text-ink">{t('demo.phasesTitle')}</h2>
            <ol className="grid gap-2.5">
              {plan.phases.map((p, i) => (
                <li key={p.n} className="flex gap-3 rounded-xl bg-paper-2 px-3.5 py-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-leaf text-[14px] font-bold text-[var(--c-on-leaf)]">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="font-bold text-ink">
                      {p.n}{' '}
                      <span className="font-normal text-ink-3">
                        · {t('demo.weeks', { n: p.weeks })} · {p.from} → {p.to}
                      </span>
                    </div>
                    <div className="text-[14.5px] text-ink-2">{p.what}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="soft-card p-4 md:p-5">
            <h2 className="mb-3 font-display text-[19px] font-bold text-ink">{t('demo.weekTitle')}</h2>
            <ul className="grid gap-1.5">
              {WEEK.map((w) => (
                <li key={w.day} className="flex items-center gap-3 rounded-xl px-2 py-2 odd:bg-paper-2">
                  <span className="w-8 shrink-0 font-bold text-leaf-2">{w.day}</span>
                  <span className="min-w-0 flex-1 text-[15px] text-ink">
                    {w.task.replace('{weak}', weakText)}
                  </span>
                  <span className="shrink-0 text-[13.5px] text-ink-3">{t('demo.minutes', { n: w.min })}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="soft-card grid gap-2 p-4 md:p-5">
            <p className="text-[15px] text-ink-2">{t('demo.suuNote', { weak: weakText })}</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={routes.desmosHome}
                className="rounded-xl bg-sage px-3.5 py-2 text-[14px] font-bold text-leaf-2"
              >
                {t('demo.goDesmos')}
              </Link>
              <Link
                href={routes.tutor()}
                className="rounded-xl bg-sage px-3.5 py-2 text-[14px] font-bold text-leaf-2"
              >
                {t('demo.goTutor')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
