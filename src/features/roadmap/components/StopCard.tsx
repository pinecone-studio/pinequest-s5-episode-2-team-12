'use client';
// A stop card in the style of the tier roadmap: topic glyph, step number, place + aimag, topic title and a
// state marker (lock · progress ring · check + stars · «Шалгалтаар давсан» chip).
import { Ring } from '@/components/ui/Ring';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import type { StopView } from '../lib/view';
import { CheckIcon, LockIcon, StarRow, TopicIcon } from './TopicIcon';

function Marker({ v, size }: { v: StopView; size: number }) {
  const t = useT('roadmap');
  switch (v.status) {
    case 'locked':
      return (
        <span
          className="grid size-8 place-items-center rounded-full bg-paper-2 text-ink-3"
          aria-hidden="true"
        >
          <LockIcon />
        </span>
      );
    case 'completed':
    case 'tested-out':
      return (
        <span
          className="grid size-8 place-items-center rounded-full bg-leaf text-[var(--c-on-leaf)] shadow-[0_3px_0_var(--c-leaf-2)]"
          aria-hidden="true"
        >
          <CheckIcon />
        </span>
      );
    case 'current':
      return (
        <Ring value={v.ring.have / Math.max(1, v.ring.need)} size={size} stroke={4} color="var(--c-lime)">
          <span className="text-[10.5px] font-extrabold tnum text-ink" aria-hidden="true">
            {v.ring.have}/{v.ring.need}
          </span>
        </Ring>
      );
    default:
      return (
        <span className="rounded-full bg-sage px-2 py-0.5 text-[11px] font-bold text-leaf-2">
          {t('sheet.start')}
        </span>
      );
  }
}

export function StopCard({
  v,
  size = 'float',
  className,
}: {
  v: StopView;
  size?: 'float' | 'full';
  className?: string;
}) {
  const t = useT('roadmap');
  const full = size === 'full';
  const locked = v.status === 'locked';
  return (
    <div
      className={cn(
        'relative rounded-[20px] border-[1.5px] bg-paper text-left',
        full ? 'p-5' : 'w-[200px] p-3',
        'border-line',
        v.status === 'available' && 'border-sage-2',
        v.status === 'current' && 'border-[var(--c-lime-2)] roadmap-pulse',
        !full && 'shadow-pop',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'grid shrink-0 place-items-center rounded-2xl',
            full ? 'size-12' : 'size-10',
            locked ? 'bg-paper-2 text-ink-3' : 'bg-sage text-leaf-2',
            v.status === 'current' && 'bg-lime text-[var(--c-on-lime)]',
          )}
          aria-hidden="true"
        >
          <TopicIcon name={v.topic.icon} size={full ? 26 : 22} />
        </span>
        <Marker v={v} size={full ? 44 : 36} />
      </div>

      <p className="eyebrow mt-2.5 !text-[10px]">{t('stopNo', { n: v.stop.no })}</p>
      <p
        className={cn(
          'font-display font-bold leading-tight text-ink',
          full ? 'mt-1 text-2xl' : 'mt-0.5 text-[15px]',
        )}
      >
        {v.topic.title}
      </p>
      <p
        className={cn(
          'mt-1.5 font-semibold text-ink-2',
          full ? 'text-[15px]' : 'line-clamp-2 text-[12.5px] leading-snug',
        )}
      >
        {v.stop.place}
      </p>
      <p className={cn('text-ink-3', full ? 'text-sm' : 'text-[11.5px]')}>{v.stop.aimag}</p>

      {(v.status === 'completed' || v.status === 'tested-out') && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {v.status === 'completed' && <StarRow stars={v.progress.stars} size={full ? 18 : 14} />}
          {v.status === 'tested-out' && (
            <span className="rounded-full border border-sage-2 bg-sage px-2 py-0.5 text-[11px] font-bold text-leaf-2">
              {t('testedOutChip')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
