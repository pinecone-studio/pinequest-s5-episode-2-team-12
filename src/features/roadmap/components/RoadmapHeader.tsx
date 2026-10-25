'use client';
// Header in the style of the tier roadmap: avatar, name, level chip, total XP and «Дараагийн бүс: … X / Y».
import { Avatar } from '@/components/shell/AppShell';
import { Gem } from '@/components/shell/icons';
import { Bar } from '@/components/ui/Bar';
import { Pill } from '@/components/ui/Pill';
import { useT } from '@/lib/i18n-client';
import { activeRegion } from '../lib/unlock';
import type { PlacementLevel, StopProgress } from '../types';

export function RoadmapHeader({
  name,
  xp,
  level,
  stops,
  showLevel,
}: {
  name: string;
  xp: number;
  level: PlacementLevel;
  stops: StopProgress[];
  showLevel: boolean;
}) {
  const t = useT('roadmap');
  const region = activeRegion(stops);
  const done = stops.filter((p) => p.completedAt).length;
  return (
    <header className="soft-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={name || 'S'} size={48} />
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold text-ink sm:text-xl">
            {t('pages.roadmap.title')}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2">
            {name && <span className="font-semibold">{name}</span>}
            {showLevel && (
              <Pill tone="leaf">
                {t('level.label')}: {t(`level.${level}`)}
              </Pill>
            )}
            <span className="inline-flex items-center gap-1 font-bold text-ink tnum">
              <Gem size={16} />
              <span className="sr-only">{t('header.xp')}: </span>
              {xp.toLocaleString('en-US')} XP
            </span>
          </div>
        </div>
      </div>

      <div className="min-w-0 flex-1 sm:max-w-md sm:ml-auto">
        {region ? (
          <>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="truncate font-bold text-ink">
                {t('header.nextRegion', { region: region.title })}
              </span>
              <span className="shrink-0 font-semibold text-ink-2 tnum">
                {t('header.regionProgress', { done: region.done, total: region.total })}
              </span>
            </div>
            <Bar
              value={region.done / region.total}
              tone="lime"
              h={10}
              className="mt-2"
              label={region.title}
            />
          </>
        ) : (
          <p className="font-bold text-leaf-2">{t('header.finished')}</p>
        )}
        <p className="mt-1.5 text-[12px] text-ink-3 tnum">{t('header.stopsDone', { done })}</p>
      </div>
    </header>
  );
}
