'use client';
import { useRouter } from 'next/navigation';
import { type CSSProperties, useId, useState } from 'react';
import { CatHead } from '@/components/brand';
import { Rich } from '@/components/math';
import { Button, Pill } from '@/components/ui';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import type { DesmosHack, DesmosLesson } from '@/types';
import { useAcademyProgress } from '../lib/progress';
import { toGraphInit } from '../lib/table-init';
import GraphCalc from './graph-calc';
import { LuCheck, LuPlay, LuSpline } from './icons';

export function AcademyHome({
  lessons: DESMOS,
  hacks: HACKS,
}: {
  lessons: DesmosLesson[];
  hacks: DesmosHack[];
}) {
  const t = useT('desmos');
  const gridId = useId();
  const { completed } = useAcademyProgress();
  const router = useRouter();
  const go = (id: string) => router.push(routes.desmos(id));
  const done = DESMOS.filter((d) => completed.includes(d.id)).length;
  return (
    <div className="pb-10">
      <section className="bg-forest text-cream relative overflow-hidden">
        <svg className="absolute inset-0 w-full h-full opacity-[0.07]" aria-hidden="true">
          <defs>
            <pattern id={gridId} width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M28 0H0V28" fill="none" stroke="var(--c-on-forest)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${gridId})`} />
        </svg>
        <div className="gutter max-w-[1240px] mx-auto py-9 md:py-12 grid md:grid-cols-[1fr_340px] gap-8 items-center relative">
          <div>
            <div className="eyebrow" style={{ color: 'var(--c-lime)' }}>
              {t('ui.suuprep_s_signature_feature')}
            </div>
            <h1 className="font-display font-extrabold text-[34px] md:text-[48px] leading-[0.98] mt-2">
              Desmos
              <br />
              {t('ui.academy')}
            </h1>
            <p className="mt-4 text-cream/75 max-w-[56ch] text-[15px]">
              {t('ui.learn_graphing_from_the_beginning_enter_equations_find_')}{' '}
              <span className="font-script text-lime text-[20px]">{t('ui.when_and_how')}</span>{' '}
              {t('ui.to_use_the_calculator')}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Button
                size="lg"
                onClick={() => go(DESMOS.find((d) => !completed.includes(d.id))?.id || 'd3')}
                variant="lime"
                icon={<LuPlay />}
              >
                {done ? t('ui.continue') : t('ui.start')}
              </Button>
              <div className="text-[13px] text-cream/70 tnum">
                {done}/{DESMOS.length} {t('ui.lessons')}
                {DESMOS.reduce((a, d) => a + d.xp, 0)} XP
              </div>
            </div>
          </div>
          <MiniGraphArt />
        </div>
      </section>

      <div className="gutter max-w-[1240px] mx-auto mt-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
          {DESMOS.map((d) => {
            const isDone = !!completed.includes(d.id);
            return (
              <button
                type="button"
                key={d.id}
                onClick={() => go(d.id)}
                id={`dl-${d.id}`}
                className={`card lift text-left p-5 flex flex-col gap-3 relative ${d.featured ? 'ring-2 ring-lime ring-offset-2 ring-offset-bg' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-thin text-[30px] leading-none text-teal tnum">
                    {String(d.no).padStart(2, '0')}
                  </span>
                  {isDone ? (
                    <Pill tone="leaf">
                      <LuCheck size={12} /> {t('ui.completed')}
                    </Pill>
                  ) : d.featured ? (
                    <Pill tone="dark">{t('ui.today_s_challenge')}</Pill>
                  ) : (
                    <Pill tone="teal">{d.skill}</Pill>
                  )}
                </div>
                <div>
                  <div className="font-display font-extrabold text-[17px] leading-snug">{d.title}</div>
                  <div className="text-[12.5px] text-ink-3 mt-0.5">{d.en}</div>
                </div>
                {d.question && (
                  <div className="text-[13px] text-ink-2 line-clamp-2">
                    <Rich text={d.question} />
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between text-[12px] text-ink-3 pt-1">
                  <span>
                    {d.minutes} {t('ui.min')}
                    {d.steps.length} {t('ui.steps')}
                  </span>
                  <span className="font-semibold text-leaf">+{d.xp} XP</span>
                </div>
              </button>
            );
          })}
        </div>

        <HackStrip hacks={HACKS} />

        <div className="mt-8 grid lg:grid-cols-[1fr_380px] gap-5">
          <div className="card p-6">
            <div className="eyebrow">{t('ui.playground')}</div>
            <h2 className="font-display font-extrabold text-[19px] mt-1">{t('ui.try_the_calculator')}</h2>
            <p className="text-[13.5px] text-ink-2 mt-1 mb-4">
              <Rich text={t('ui.equations_inequalities_points_a_b_sliders_a_2_and_table')} />
            </p>
            <GraphCalc initialRows={['y=x^2-4', 'y=x+2', '']} height={420} label={t('ui.free_calculator')} />
          </div>
          <div className="card p-6 h-fit">
            <div className="eyebrow">{t('ui.strategy')}</div>
            <h3 className="font-display font-extrabold text-[17px] mt-1">
              {t('ui.when_should_you_use_desmos')}
            </h3>
            <ul className="mt-4 grid gap-2.5 text-[14px]">
              {[
                [t('ui.intersections_and_systems'), true],
                [t('ui.roots_and_quadratic_equations'), true],
                [t('ui.vertices_and_extrema'), true],
                [t('ui.tables_and_regression'), true],
                [t('ui.inequality_solutions'), true],
                [t('ui.one_step_arithmetic'), false],
                [t('ui.word_meaning_and_explanation'), false],
              ].map(([text, y]) => (
                <li key={text as string} className="flex items-center gap-3">
                  <span
                    className={`h-6 w-6 rounded-full grid place-items-center text-[11px] font-bold ${y ? 'bg-teal text-white' : 'bg-paper-2 text-ink-3'}`}
                  >
                    {y ? <LuSpline size={13} /> : '✎'}
                  </span>
                  <span className={y ? '' : 'text-ink-3'}>{text}</span>
                  <span className="ml-auto text-[11.5px] text-ink-3">{y ? 'Desmos' : t('ui.by_hand')}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] text-ink-3 leading-relaxed">
              {t('ui.this_is_suuprep_s_own_teaching_calculator_the_official_')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function HackStrip({ hacks: HACKS }: { hacks: DesmosHack[] }) {
  const t = useT('desmos');
  const [h, setH] = useState(0);
  const hack = HACKS[h];
  return (
    <section className="mt-8 card p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow">Desmos hack</div>
          <h2 className="font-display font-bold text-[18px] mt-1">{t('ui.5_useful_sat_techniques')}</h2>
        </div>
        <span className="text-[12.5px] text-ink-3">{t('ui.choose_a_hack_and_try_it_in_the_calculator')}</span>
      </div>
      <div className="mt-4 grid lg:grid-cols-[300px_1fr] gap-5">
        <div className="grid gap-2 content-start">
          {HACKS.map((x, i) => (
            <button
              type="button"
              key={x.title}
              onClick={() => setH(i)}
              id={`hack-${i}`}
              className={`text-left rounded-2xl border-[1.5px] px-4 py-3 transition-transform ${h === i ? 'border-leaf bg-sage' : 'border-line bg-paper hover:border-line-2'}`}
              style={{ boxShadow: `0 3px 0 ${h === i ? 'var(--c-leaf-2)' : 'var(--c-edge)'}` }}
            >
              <span className="font-mono text-[10.5px] font-bold text-ink-3 tracking-wider">
                HACK {i + 1}
              </span>
              <span className="block font-display font-bold text-[14px] mt-0.5">{x.title}</span>
            </button>
          ))}
        </div>
        <div className="grid md:grid-cols-[1fr_1.2fr] gap-4 min-w-0">
          <div>
            <div className="font-display font-bold text-[17px]">{hack.title}</div>
            <div className="text-[13px] text-ink-3 mt-0.5">
              {t('ui.when')}
              {hack.when}
            </div>
            <ol className="mt-4 grid gap-2.5">
              {hack.steps.map((st, k) => (
                <li key={st} className="flex gap-3 items-start text-[14px]">
                  <span
                    className="coin h-7 w-7 shrink-0 rounded-full grid place-items-center text-[12px] font-bold text-white"
                    style={{ '--face': 'var(--c-teal)', '--edge': 'var(--c-teal-2)' } as CSSProperties}
                  >
                    {k + 1}
                  </span>
                  {st}
                </li>
              ))}
            </ol>
          </div>
          <div className="h-[300px] min-w-0">
            <GraphCalc
              key={h}
              initialRows={toGraphInit(hack.rows)}
              height="100%"
              label={`Hack ${h + 1}`}
              listWidth={200}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniGraphArt() {
  return (
    <div className="relative hidden md:block h-[240px]" aria-hidden="true">
      <div className="absolute inset-0 rounded-3xl bg-paper overflow-hidden shadow-pop">
        <svg viewBox="0 0 340 240" className="w-full h-full">
          <g stroke="var(--c-graph-grid)">
            {Array.from({ length: 18 }).map((_, i) => (
              <path key={i} d={`M${i * 20} 0V240M0 ${i * 20}H340`} />
            ))}
          </g>
          <path d="M170 0V240M0 120H340" stroke="var(--c-graph-axis)" strokeWidth={1.4} />
          <path
            d="M60 240 Q170 -120 280 240"
            fill="none"
            stroke="var(--c-leaf)"
            strokeWidth={3}
            className="draw-path"
            style={{ '--len': 520 } as CSSProperties}
          />
          <path
            d="M20 200 L330 40"
            stroke="var(--c-rose)"
            strokeWidth={3}
            className="draw-path"
            style={{ '--len': 350, animationDelay: '.4s' } as CSSProperties}
          />
          <circle
            cx={110}
            cy={174}
            r={6}
            fill="var(--c-paper)"
            stroke="var(--c-ink-3)"
            strokeWidth={2.2}
            className="anim-pop"
            style={{ animationDelay: '1.6s' }}
          />
          <circle
            cx={244}
            cy={105}
            r={6}
            fill="var(--c-ink-2)"
            className="anim-pop"
            style={{ animationDelay: '1.8s' }}
          />
        </svg>
        <div
          className="absolute right-6 top-[78px] rounded-lg bg-ink text-paper px-2 py-1 text-[12px] font-semibold anim-pop"
          style={{ animationDelay: '1.9s' }}
        >
          (3, 5)
        </div>
      </div>
      <div className="absolute -left-10 -bottom-6">
        <CatHead size={92} mood="focus" />
      </div>
    </div>
  );
}
