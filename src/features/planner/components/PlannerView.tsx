'use client';
// /planner · AI төлөвлөгөө. The student sets the exam date, scores, time, weak topics and a note
// ("Мягмар гарагт дугуйлантай"); POST /api/suu/planner adds their own answers (topic accuracy, time, trend) and the
// habits in their mistakes, and Суу's planner skill writes the 7-day plan (the rule engine while Суу is off,
// labelled). The phase timeline above it is computed (lib/demo-plan.ts).
import Link from 'next/link';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import type { PlannerResponse } from '@/app/api/suu/planner/route';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { localStudentData } from '@/features/mistakes/lib/local-data';
import { usePlacementWeakIds } from '@/features/roadmap/components/placement-weak';
import { TOPICS, topicById } from '@/features/roadmap/topics';
import type { RoadmapState } from '@/features/roadmap/types';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { dayKey } from '@/lib/time';
import { buildPlan, type DemoPlan, type Phase } from '../lib/demo-plan';

type SatDate = { d: string; reg: string; late: string };
type Task = PlannerResponse['plan']['week'][number]['tasks'][number];

const field =
  'h-11 w-full rounded-xl border border-line bg-paper px-3 text-[15px] text-ink outline-none focus:border-leaf';

/** Where each kind of task is done in the app. */
function taskHref(t: Task): string {
  switch (t.t) {
    case 'lesson':
      return t.topic ? routes.roadmapStop(t.topic) : routes.home;
    case 'desmos':
      return routes.desmosHome;
    case 'practice':
      return routes.practice(t.timed ? { timed: true } : {});
    case 'cards':
      return routes.flashcards(t.topic);
    case 'mock':
      return routes.mock;
    case 'review':
      return routes.mistakes;
  }
}

export function PlannerView({
  dates,
  phases,
  roadmap = { demo: true, server: null, ids: [] },
  fetchImpl,
}: {
  dates: SatDate[];
  phases: Phase[];
  /** Placement result → weak topics («Монголын аялал»); demo = no account (data in localStorage). */
  roadmap?: { demo: boolean; server: RoadmapState | null; ids: number[] };
  fetchImpl?: typeof fetch;
}) {
  const t = useT('planner');
  const noteId = useId();
  const addId = useId();
  const today = dayKey();
  const upcoming = dates.filter((d) => d.d > today);
  const [examDate, setExamDate] = useState(upcoming[1]?.d ?? upcoming[0]?.d ?? dates[dates.length - 1]?.d);
  const [current, setCurrent] = useState(600);
  const [target, setTarget] = useState(750);
  const [hours, setHours] = useState(1.5);
  const [note, setNote] = useState('');
  const placementWeak = usePlacementWeakIds(roadmap);
  const [weak, setWeak] = useState<number[]>([]);
  const fromPlacement = placementWeak.join(',');
  // the placement result arrives after mount in demo mode (localStorage)
  useEffect(() => {
    if (fromPlacement) setWeak(fromPlacement.split(',').map(Number));
  }, [fromPlacement]);
  const [timeline, setTimeline] = useState<DemoPlan | null>(null);
  const [res, setRes] = useState<PlannerResponse | null>(null);
  const [state, setState] = useState<'idle' | 'thinking' | 'error'>('idle');
  const doFetch = fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const fetchRef = useRef(doFetch);
  fetchRef.current = doFetch;
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!examDate) return;
    pending.current?.abort();
    const ctrl = new AbortController();
    pending.current = ctrl;
    setRes(null);
    setState('thinking');
    setTimeline(buildPlan({ examDate, today, current, target, hoursPerDay: hours }, phases));
    const send = fetchRef.current;
    const data = await send('/api/suu/planner', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        today,
        examDate,
        current,
        target,
        hoursPerDay: hours,
        ...(note.trim() ? { note: note.trim() } : {}),
        weakIds: weak,
        ...(roadmap.demo ? localStudentData() : {}),
      }),
      signal: ctrl.signal,
    })
      .then(async (r) => (r.ok ? ((await r.json()) as PlannerResponse) : null))
      .catch(() => null);
    if (ctrl.signal.aborted) return;
    setRes(data);
    setState(data ? 'idle' : 'error');
  }

  const topicName = (id?: number) => (id ? (topicById(id)?.title ?? `#${id}`) : '');
  const chosen = weak.map((id) => topicById(id)).filter((x) => x !== undefined);
  const plan = res?.plan;

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
          <p className="text-[13px] text-ink-3">{t('demo.weakHint')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {chosen.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => setWeak((w) => w.filter((x) => x !== topic.id))}
                aria-label={t('demo.removeTopic', { topic: topic.title })}
                className="rounded-full border border-leaf bg-sage px-3.5 py-1.5 text-[13.5px] font-semibold text-leaf-2"
              >
                {topic.title} ×
              </button>
            ))}
            <label htmlFor={addId} className="sr-only">
              {t('demo.addTopic')}
            </label>
            <select
              id={addId}
              value=""
              onChange={(e) => e.target.value && setWeak((w) => [...w, Number(e.target.value)].slice(0, 8))}
              className="h-9 max-w-[240px] rounded-full border border-line bg-paper px-3 text-[13.5px] text-ink-2"
            >
              <option value="">+ {t('demo.addTopic')}</option>
              {TOPICS.filter((x) => !weak.includes(x.id)).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.id}. {x.title}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <label htmlFor={noteId} className="grid gap-1.5 text-[13.5px] font-semibold text-ink-2">
          {t('demo.note')}
          <textarea
            id={noteId}
            rows={2}
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('demo.notePlaceholder')}
            className="resize-none rounded-xl border border-line bg-paper px-3 py-2 text-[15px] font-normal text-ink outline-none focus:border-leaf"
          />
        </label>

        <div>
          <Button type="submit" size="lg" disabled={state === 'thinking' || !examDate}>
            {t('demo.make')}
          </Button>
        </div>
      </form>

      {state === 'thinking' && (
        <p className="animate-pulse text-[15px] text-ink-3" role="status">
          {t('demo.thinking')}
        </p>
      )}
      {state === 'error' && <p className="text-[15px] text-ink-2">{t('demo.error')}</p>}

      {plan && res && timeline && (
        <div className="grid gap-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={res.source === 'model' ? 'teal' : 'amber'}>
              {res.source === 'model' ? t('demo.model') : t('demo.rules')}
            </Pill>
            <span className="text-[14px] text-ink-3">
              {t('demo.forDate', { date: examDate ?? '' })} · {t(`demo.phase.${plan.phase}`)}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [t('demo.weeksLeft'), String(timeline.weeks)],
              [t('demo.totalHours'), String(timeline.totalHours)],
              [t('demo.gain'), `+${timeline.gain}`],
            ].map(([label, value]) => (
              <div key={label} className="soft-card p-4">
                <div className="text-[13px] font-semibold text-ink-3">{label}</div>
                <div className="font-display text-[30px] font-extrabold text-ink">{value}</div>
              </div>
            ))}
          </div>

          <div className="soft-card grid gap-3 p-4 md:p-5">
            <h2 className="font-display text-[19px] font-bold text-ink">{t('demo.focusTitle')}</h2>
            {plan.focus.length ? (
              <ol className="grid gap-2">
                {plan.focus.map((f, i) => (
                  <li key={f.id} className="flex gap-3 rounded-xl bg-paper-2 px-3.5 py-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-leaf text-[13px] font-bold text-[var(--c-on-leaf)]">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-ink">{topicName(f.id)}</div>
                      <div className="text-[14px] text-ink-2">{f.why}</div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[14.5px] text-ink-2">{t('demo.noFocus')}</p>
            )}
            {plan.check.length > 0 && (
              <p className="text-[14px] text-ink-2">
                <strong className="text-ink">{t('demo.checkTitle')}:</strong>{' '}
                {plan.check.map((id) => topicName(id)).join(', ')}
              </p>
            )}
          </div>

          <div className="soft-card p-4 md:p-5">
            <h2 className="mb-3 font-display text-[19px] font-bold text-ink">{t('demo.weekTitle')}</h2>
            <ul className="grid gap-1.5" aria-label={t('demo.weekTitle')}>
              {plan.week.map((d) => (
                <li
                  key={d.day}
                  className="flex flex-wrap items-center gap-2 rounded-xl px-2 py-2 odd:bg-paper-2"
                >
                  <span className="w-8 shrink-0 font-bold text-leaf-2">{d.day}</span>
                  <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                    {d.tasks.length === 0 && (
                      <span className="text-[14.5px] text-ink-3">{t('demo.rest')}</span>
                    )}
                    {d.tasks.map((task, i) => (
                      <Link
                        key={`${task.t}-${i}`}
                        href={taskHref(task)}
                        className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[13.5px] text-ink hover:border-leaf"
                      >
                        {t(`demo.task.${task.t}`)}
                        {task.topic ? `: ${topicName(task.topic)}` : ''}
                        {task.timed ? ` · ⏱ ${t('demo.timed')}` : ''}
                        <span className="text-ink-3"> · {t('demo.minutes', { n: task.min })}</span>
                      </Link>
                    ))}
                  </span>
                  <span className="shrink-0 text-[13.5px] font-semibold text-ink-3">
                    {t('demo.minutes', { n: d.min })}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="soft-card p-4 md:p-5">
            <h2 className="mb-3 font-display text-[19px] font-bold text-ink">{t('demo.phasesTitle')}</h2>
            <ol className="grid gap-2.5">
              {timeline.phases.map((p, i) => (
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

          <div className="soft-card grid gap-2 p-4 md:p-5">
            <h2 className="font-display text-[19px] font-bold text-ink">{t('demo.adviceTitle')}</h2>
            <p className="text-[15px] leading-relaxed text-ink-2">{plan.advice}</p>
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
