'use client';
// The stop panel (a pin was clicked): right-side panel on desktop, bottom sheet on phones (Sheet). Header,
// place line, topic, what's inside, «Танд» numbers, related cards / Desmos / lessons / mistakes, and the
// actions. ← / → move between stops, Esc closes. Static content loads on open (detail-actions.ts).
import Link from 'next/link';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { Rich, Tex } from '@/components/math';
import { Pill, type PillTone } from '@/components/ui/Pill';
import { Sheet } from '@/components/ui/Sheet';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import { guideFor } from '../content/guides';
import { loadStopDetail, type StopDetailResult } from '../detail-actions';
import { blockingStop, missedOn, stopPlan, topicMastery } from '../lib/plan';
import type { StopView } from '../lib/view';
import { stopByNo } from '../stops';
import type { ProblemAttempt, RoadmapState } from '../types';
import { StarRow, TopicIcon } from './TopicIcon';

const cache = new Map<number, Promise<StopDetailResult | null>>();
function fetchDetail(no: number) {
  let p = cache.get(no);
  if (!p) {
    p = loadStopDetail(no).catch(() => {
      cache.delete(no);
      return null;
    });
    cache.set(no, p);
  }
  return p;
}

function useStopDetail(no: number | null) {
  const [state, setState] = useState<{ no: number; detail: StopDetailResult | null; done: boolean } | null>(
    null,
  );
  useEffect(() => {
    if (no === null) return;
    let live = true;
    setState((s) => (s?.no === no ? s : { no, detail: null, done: false }));
    fetchDetail(no).then((detail) => live && setState({ no, detail, done: true }));
    // warm the neighbours so ← / → feel instant
    for (const n of [no - 1, no + 1]) if (n >= 1 && n <= 26) void fetchDetail(n);
    return () => {
      live = false;
    };
  }, [no]);
  return state?.no === no ? state : null;
}

const STATUS_TONE: Record<StopView['status'], PillTone> = {
  locked: 'neutral',
  available: 'leaf',
  current: 'amber',
  completed: 'leaf',
  'tested-out': 'teal',
};

const cta =
  'btn3d inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-[14px] font-bold mb-[5px]';
const lime = {
  '--face': 'var(--c-lime)',
  '--edge': 'var(--c-lime-2)',
  color: 'var(--c-on-lime)',
} as React.CSSProperties;
const soft = {
  '--face': 'var(--c-sage)',
  '--edge': 'var(--c-sage-2)',
  color: 'var(--c-leaf-ink)',
} as React.CSSProperties;
const quiet =
  'inline-flex h-10 items-center gap-2 rounded-2xl border border-line px-3.5 text-[13px] font-bold text-ink-2 hover:border-leaf hover:text-ink';

function Section({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section className="grid gap-2.5 border-t border-line pt-4" aria-labelledby={id}>
      <h3 id={id} className="text-[12px] font-bold uppercase tracking-[0.12em] text-ink-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function StopPanel({
  v,
  views,
  state,
  open,
  demo,
  history,
  onClose,
  onMove,
  inline = false,
}: {
  v: StopView | undefined;
  views: StopView[];
  state: RoadmapState;
  /** The roadmap is open (placement done or skipped). */
  open: boolean;
  demo: boolean;
  history: ProblemAttempt[];
  onClose: () => void;
  onMove: (no: number) => void;
  /** Borderless overview in the open space above the home map. */
  inline?: boolean;
}) {
  const t = useT('roadmap');
  const uid = useId();
  const no = v?.stop.no ?? null;
  const loaded = useStopDetail(no);
  const [preview, setPreview] = useState(false);
  const [overviewTab, setOverviewTab] = useState('topic');
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new stop closes the preview
  useEffect(() => {
    setPreview(false);
    setOverviewTab('topic');
  }, [no]);

  // ← / → between stops while the panel is open (not while typing)
  useEffect(() => {
    if (no === null) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof Element && el.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'ArrowLeft' && no > 1) onMove(no - 1);
      else if (e.key === 'ArrowRight' && no < views.length) onMove(no + 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [no, onMove, views.length]);

  if (!v) return null;

  const detail = loaded?.detail ?? null;
  const locked = v.status === 'locked';
  const done = v.status === 'completed' || v.status === 'tested-out';
  const plan = stopPlan(state, v.stop.no);
  const mastery = topicMastery(state, v.stop.no);
  const blocker = locked && open ? blockingStop(state, v.stop.no) : null;
  const missed = demo ? missedOn(history, v.topic.id) : detail?.missed;
  const showInside = !locked || preview;
  const example = detail?.intros.find((s) => /жишээ/i.test(s.title)) ?? detail?.intros[1];
  const tip = detail?.intros.find((s) => /desmos|тооны машин/i.test(s.title));
  const label = `${t('panel.stopNo', { n: v.stop.no })}, ${v.stop.place}`;

  if (inline) {
    const overviewGuide = detail?.guide ?? guideFor(v.topic.id);
    return (
      <section aria-label={label} className="roadmap-stop-overview roadmap-featured-topic absolute z-20">
        <header className="grid gap-3">
          <p className="eyebrow">
            {t('panel.stopNo', { n: v.stop.no })} · {v.region.title}
          </p>
          <div className="flex items-start gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[clamp(26px,3vw,44px)] font-bold leading-tight text-ink">
                {v.topic.title}
              </h2>
              <p className="mt-1 text-[13px] text-ink-3">
                {v.stop.place} · {v.stop.aimag}
              </p>
            </div>
          </div>
        </header>
        {overviewGuide && (
          <ul className="grid gap-2 text-[14px] text-ink-2">
            {overviewGuide.goals.map((goal) => (
              <li key={goal} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-leaf" />
                <Rich text={goal} />
              </li>
            ))}
          </ul>
        )}
        <div className="roadmap-stop-start">
          {locked && open ? (
            <button type="button" disabled className={cta} style={lime}>
              {t('sheet.start')}
            </button>
          ) : (
            <Link
              href={!open ? routes.placement : routes.roadmapStop(v.stop.no)}
              className={cta}
              style={lime}
            >
              {t('sheet.start')}
            </Link>
          )}
        </div>
      </section>
    );
  }

  const content = (
    <>
      {/* header */}
      <header className={cn('grid gap-3', inline && 'col-span-full')}>
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow">
            {t('panel.stopNo', { n: v.stop.no })} · {v.region.title}
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onMove(v.stop.no - 1)}
              disabled={v.stop.no <= 1}
              aria-label={t('panel.prev')}
              className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-paper-2 disabled:opacity-30"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onMove(v.stop.no + 1)}
              disabled={v.stop.no >= views.length}
              aria-label={t('panel.next')}
              className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-paper-2 disabled:opacity-30"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('panel.close')}
              className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-paper-2"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sage text-leaf-2">
            <TopicIcon name={v.topic.icon} size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className={cn(
                'font-display font-bold leading-tight text-ink',
                inline ? 'text-[clamp(24px,2.6vw,40px)]' : 'text-[24px]',
              )}
            >
              {inline ? v.topic.title : v.stop.place}
            </h2>
            <p className="text-[13px] text-ink-3">
              {inline ? `${v.stop.place} · ${v.stop.aimag}` : v.stop.aimag}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={STATUS_TONE[v.status]}>{t(`status.${v.status}`)}</Pill>
          {v.status === 'completed' && v.progress.stars > 0 && (
            <span className="inline-flex items-center gap-1 text-[12px] text-ink-3">
              <StarRow stars={v.progress.stars} />
              <span className="sr-only">{t('status.stars', { n: v.progress.stars })}</span>
            </span>
          )}
        </div>
      </header>

      {inline && (
        <nav className="roadmap-overview-tabs flex gap-2 overflow-x-auto" aria-label={t('panel.topic')}>
          {['topic', ...(showInside ? ['inside', 'forYou', 'related'] : [])].map((tab) => (
            <button
              type="button"
              key={tab}
              aria-pressed={overviewTab === tab}
              onClick={() => setOverviewTab(tab)}
              className={cn(
                'shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold',
                overviewTab === tab ? 'bg-sage text-leaf-2' : 'text-ink-3 hover:bg-paper-2',
              )}
            >
              {t(`panel.${tab}`)}
            </button>
          ))}
        </nav>
      )}
      {/* topic */}
      <Section title={t('panel.topic')} id={`${uid}-topic`}>
        <div>
          {!inline && <p className="font-bold text-[16px] leading-snug text-ink">{v.topic.title}</p>}
          <p className="mt-0.5 font-mono text-[11.5px] text-ink-3">
            {v.topic.cbDomain} · {v.topic.cbSkill}
          </p>
        </div>
        {detail?.guide ? (
          <p className="text-[14px] leading-relaxed text-ink-2">
            <Rich text={detail.guide.summary} />
          </p>
        ) : (
          <div className="skeleton h-12 rounded-xl bg-paper-2">
            <span className="sr-only">{t('panel.loading')}</span>
          </div>
        )}
      </Section>

      {/* locked: what unlocks it */}
      {locked && !inline && (
        <div className="grid gap-2 rounded-2xl bg-paper-2 px-4 py-3">
          <p className="text-[13.5px] font-semibold text-ink-2">
            {!open
              ? t('sheet.closedRoadmap')
              : blocker
                ? t('panel.lockedBy', { n: blocker, place: stopByNo(blocker)?.place ?? '' })
                : t('sheet.locked')}
          </p>
          <div className="flex flex-wrap gap-2">
            {!open && (
              <Link href={routes.placement} className={cta} style={lime}>
                {t('gate.prompt')}
              </Link>
            )}
            <button
              type="button"
              aria-expanded={preview}
              onClick={() => setPreview((p) => !p)}
              className={quiet}
            >
              {preview ? t('panel.hidePreview') : t('panel.preview')}
            </button>
          </div>
        </div>
      )}

      {/* what's inside */}
      {showInside && detail?.guide && (
        <Section title={t('panel.inside')} id={`${uid}-inside`}>
          <ul className="grid gap-1.5 text-[14px] text-ink-2">
            {detail.guide.goals.map((goal) => (
              <li key={goal} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-leaf" />
                <Rich text={goal} />
              </li>
            ))}
          </ul>
          {detail.guide.formulas.length > 0 && (
            <div className="grid gap-2">
              <p className="text-[12.5px] font-semibold text-ink-3">{t('panel.formulas')}</p>
              {detail.guide.formulas.map((f) => (
                <div
                  key={f}
                  className="overflow-x-auto rounded-xl border border-line bg-paper px-3 py-2 scroll-thin"
                >
                  <Tex tex={f} display />
                </div>
              ))}
            </div>
          )}
          {example && (
            <details className="group rounded-xl border border-line bg-paper px-3 py-2">
              <summary className="cursor-pointer select-none text-[13.5px] font-bold text-leaf-2">
                {t('panel.example')}
              </summary>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
                <Rich text={example.body} />
              </p>
            </details>
          )}
          <p className="text-[11.5px] text-ink-3">{t('panel.draft')}</p>
        </Section>
      )}

      {/* for you */}
      {showInside && (
        <Section title={t('panel.forYou')} id={`${uid}-you`}>
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            {(
              [
                [
                  t('panel.mastery'),
                  `${t(`mastery.${mastery.mastery}`)}`,
                  t(`panel.source.${mastery.source}`),
                ],
                [
                  t('panel.best'),
                  v.progress.attempts > 0 ? `${Math.round(v.progress.best * 100)}%` : t('panel.noBest'),
                  v.progress.attempts > 0 ? `${v.progress.attempts}×` : '',
                ],
                [
                  t('panel.set'),
                  t('panel.problems', { n: plan.total }),
                  t('panel.mix', { e: plan.mix.easy, m: plan.mix.medium, h: plan.mix.hard }),
                ],
                [
                  t('panel.time'),
                  t('panel.minutes', { n: plan.minutes }),
                  t('panel.xp', { pass: plan.xp.pass, max: plan.xp.max }),
                ],
              ] as const
            ).map(([k, val, sub]) => (
              <div key={k} className="rounded-2xl bg-paper-2 px-3 py-2">
                <dt className="text-ink-3">{k}</dt>
                <dd className="font-bold text-ink tnum">{val}</dd>
                {sub && <dd className="text-[11.5px] text-ink-3">{sub}</dd>}
              </div>
            ))}
          </dl>
        </Section>
      )}

      {/* related */}
      {showInside && detail && (
        <Section title={t('panel.related')} id={`${uid}-related`}>
          {detail.cards.length > 0 && (
            <div className="grid gap-1.5">
              <p className="text-[12.5px] font-semibold text-ink-3">{t('panel.cards')}</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.cards.map((c) => (
                  <Link
                    key={`${c.deck}/${c.id}`}
                    href={routes.flashcards(v.topic.id)}
                    className="rounded-xl border border-line bg-paper px-2.5 py-1 text-[12.5px] font-semibold text-ink-2 hover:border-leaf"
                  >
                    {c.front} <span className="text-ink-3">· {c.back}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {(tip || detail.desmos.length > 0) && (
            <div className="grid gap-1.5">
              <p className="text-[12.5px] font-semibold text-ink-3">{t('panel.desmos')}</p>
              {tip && (
                <p className="text-[13.5px] leading-relaxed text-ink-2">
                  <Rich text={tip.body} />
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {detail.desmos.map((d) => (
                  <Link key={d.id} href={routes.desmos(d.id)} className={quiet}>
                    {d.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {detail.lessons.length > 0 && (
            <div className="grid gap-1.5">
              <p className="text-[12.5px] font-semibold text-ink-3">{t('panel.lessons')}</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.lessons.map((l) => (
                  <Link key={l.id} href={routes.lesson(l.id)} className={quiet}>
                    {l.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {missed !== null && missed !== undefined && (
            <p className="text-[13px] text-ink-2">
              {missed > 0 ? (
                <Link href={routes.mistakes} className="font-bold text-leaf-2 underline underline-offset-4">
                  {t('panel.mistakeCount', { n: missed })}
                </Link>
              ) : (
                t('panel.noMistakes')
              )}
            </p>
          )}
        </Section>
      )}

      {loaded?.done && !detail && <p className="text-[13px] text-danger">{t('panel.failed')}</p>}

      {!inline && <p className="hidden text-center text-[11.5px] text-ink-3 md:block">{t('panel.keys')}</p>}
      {/* actions */}
      {!locked && open && (
        <div
          className={
            inline
              ? 'roadmap-overview-actions col-span-full flex flex-wrap items-center gap-3 border-t border-line pt-3'
              : 'sticky -bottom-5 -mx-5 -mb-5 grid gap-2 border-t border-line bg-paper px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] md:-bottom-6 md:-mx-6 md:-mb-6 md:px-6 md:pb-6'
          }
        >
          <Link href={routes.roadmapStop(v.stop.no)} className={cta} style={done ? soft : lime}>
            {done ? t('sheet.replay') : v.status === 'current' ? t('sheet.continue') : t('sheet.start')}
          </Link>
          <div className="flex flex-wrap gap-2">
            {detail && detail.intros.length > 0 && (
              <Link href={routes.roadmapStop(v.stop.no, { intro: true })} className={quiet}>
                {t('panel.lesson')}
              </Link>
            )}
            {!done && mastery.mastery === 'strong' && (
              <Link
                href={routes.roadmapStop(v.stop.no, { testOut: true })}
                className={quiet}
                title={t('sheet.testOutHint')}
              >
                {t('sheet.testOut')}
              </Link>
            )}
            <Link
              href={routes.tutor({ kind: 'topic', id: String(v.topic.id) })}
              className={cn(quiet, 'ml-auto')}
            >
              {t('panel.ask')}
            </Link>
          </div>
        </div>
      )}
      {locked && (
        <div
          className={
            inline ? 'roadmap-overview-actions flex flex-wrap items-center gap-2' : 'flex justify-end'
          }
        >
          {inline && (
            <>
              <p className="text-[12px] text-ink-3">
                {!open
                  ? t('sheet.closedRoadmap')
                  : blocker
                    ? t('panel.lockedBy', { n: blocker, place: stopByNo(blocker)?.place ?? '' })
                    : t('sheet.locked')}
              </p>
              {!open && (
                <Link href={routes.placement} className={cta} style={lime}>
                  {t('gate.prompt')}
                </Link>
              )}
              <button
                type="button"
                className={quiet}
                aria-expanded={preview}
                onClick={() => {
                  setPreview(!preview);
                  setOverviewTab(!preview ? 'inside' : 'topic');
                }}
              >
                {preview ? t('panel.hidePreview') : t('panel.preview')}
              </button>
            </>
          )}
          <Link href={routes.tutor({ kind: 'topic', id: String(v.topic.id) })} className={quiet}>
            {t('panel.ask')}
          </Link>
        </div>
      )}
    </>
  );

  return (
    <Sheet
      open
      onClose={onClose}
      label={label}
      className="grid content-start gap-4"
      phoneHeight="max-h-[68dvh]"
    >
      {content}
    </Sheet>
  );
}
