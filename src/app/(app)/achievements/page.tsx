import { Pill } from '@/components/ui/Pill';
import { getProfile } from '@/features/home/queries';
import { BadgeEmblem } from '@/features/progress/components/BadgeEmblem';
import { listBadges } from '@/features/progress/queries';
import { cn } from '@/lib/cn';
import { getT } from '@/lib/i18n';

export const metadata = { title: 'Амжилтууд' };

// Section F · F4 — every badge from the single catalog (src/mocks/meta.ts BADGES), earned ones from user_badges.
export default async function AchievementsPage() {
  const t = getT('progress');
  const profile = await getProfile();
  const badges = await listBadges(profile.id).catch(() => []);
  const earned = badges.filter((b) => b.earned).length;
  const groups = [
    { key: 'core', items: badges.filter((b) => !b.id.startsWith('roadmap-')) },
    { key: 'roadmap', items: badges.filter((b) => b.id.startsWith('roadmap-')) },
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="eyebrow">{t('achievements.eyebrow')}</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink sm:text-4xl">
            {t('achievements.title')}
          </h1>
          <p className="mt-2 text-sm text-ink-2">{t('achievements.lead')}</p>
        </div>
        <p className="text-right">
          <span className="font-display text-4xl font-bold text-ink tnum">
            <span className="text-leaf-2">{earned}</span>/{badges.length}
          </span>
          <span className="block text-xs uppercase tracking-wider text-ink-3">
            {t('achievements.collected')}
          </span>
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-4">
          {g.key === 'roadmap' && (
            <h2 className="font-display text-xl font-bold text-ink">{t('achievements.roadmap')}</h2>
          )}
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {g.items.map((b) => (
              <li
                key={b.id}
                className={cn(
                  'soft-card flex flex-col items-center p-5 text-center',
                  !b.earned && 'opacity-70',
                )}
              >
                <BadgeEmblem badge={b} earned={b.earned} size={80} />
                <h3 className="mt-3 text-[15px] font-bold text-ink">{b.mn}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-2">{b.how}</p>
                <Pill tone={b.earned ? 'leaf' : 'neutral'} className="mt-4">
                  {b.earned ? t('achievements.earned') : t('achievements.locked')}
                </Pill>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
