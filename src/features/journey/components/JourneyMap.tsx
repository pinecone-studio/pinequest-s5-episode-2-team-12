import Link from 'next/link';
import { CatHead } from '@/components/brand';
import { Pill } from '@/components/ui/Pill';
import { useT } from '@/lib/i18n-client';
import { routes } from '@/lib/routes';
import type { Stage } from '@/types';
import { nextLesson, nodeStatus } from '../lib/unlock';
import type { LessonProgress } from '../queries';
import { StageSection } from './StageSection';

type JourneyMapProps = {
  stages: Stage[];
  progress: LessonProgress[];
};

export function JourneyMap({ stages, progress }: JourneyMapProps) {
  const tr = useT('roadmap');
  const next = nextLesson(progress);
  const nextHref = next
    ? next.kind === 'desmos'
      ? routes.desmos(next.desmosId ?? next.id)
      : routes.lesson(next.id)
    : null;

  const completed = stages.reduce(
    (count, stage) => count + stage.nodes.filter((lesson) => nodeStatus(progress, lesson) === 'done').length,
    0,
  );

  const total = stages.reduce((count, stage) => count + stage.nodes.length, 0);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-5 rounded-3xl border border-line bg-paper p-6 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="max-w-xl">
          <Pill tone="leaf">SUPREP JOURNEY</Pill>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-ink sm:text-4xl">Миний замнал</h1>

          <p className="mt-3 text-sm leading-6 text-ink-2">
            Математикийн англи хэлнээс эхлээд SAT Math-ийн бодлого хүртэл алхам алхмаар суралцаарай.
          </p>

          <p className="mt-4 text-sm font-bold text-leaf-2">
            {completed}/{total} хичээл дууссан
          </p>

          {next && (
            <Link
              href={nextHref ?? routes.journey}
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-lime px-5 py-3 text-sm font-extrabold text-[var(--c-on-lime)] shadow-[0_4px_0_var(--c-lime-2)] transition-transform hover:-translate-y-0.5"
            >
              Үргэлжлүүлэх →
            </Link>
          )}
        </div>

        <div className="mx-auto w-32 shrink-0 sm:mx-0 sm:w-40">
          <CatHead mood="happy" />
        </div>
      </header>

      <Link
        href={routes.home}
        className="group flex items-center gap-4 rounded-3xl border border-sage-2 bg-sage p-5 transition-colors hover:border-leaf"
      >
        <span
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-lime text-[var(--c-on-lime)]"
          aria-hidden="true"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z" />
            <path d="M9 4.5v13M15 6.5v13" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold text-ink">{tr('journeyBanner.title')}</span>
          <span className="block text-sm text-ink-2">{tr('journeyBanner.body')}</span>
        </span>
        <span className="hidden shrink-0 font-bold text-leaf-2 group-hover:underline sm:inline">
          {tr('journeyBanner.cta')} →
        </span>
      </Link>

      <div className="flex flex-col gap-7">
        {stages.map((stage) => (
          <StageSection
            key={stage.id}
            stage={stage}
            getStatus={(lessonId) => {
              const lesson = stage.nodes.find((node) => node.id === lessonId);

              return lesson ? nodeStatus(progress, lesson) : 'locked';
            }}
          />
        ))}
      </div>
    </div>
  );
}
