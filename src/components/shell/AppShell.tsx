'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { Logo } from '@/components/brand';
import { Sheet } from '@/components/ui/Sheet';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { isActive, NAV, type NavGroup, type NavItem } from '@/lib/nav';
import { routes } from '@/lib/routes';
import { Flame, Gem, Icon } from './icons';

export type ShellUser = { name: string; level: number; xp: number; streak: number };

function NavLink({ item, pathname, onClick }: { item: NavItem; pathname: string; onClick?: () => void }) {
  const t = useT('common');
  const on = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={on ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 h-11 px-3.5 rounded-2xl text-[14.5px] font-semibold transition-colors',
        on
          ? 'bg-sage text-leaf-2 shadow-[inset_0_0_0_1px_var(--c-sage-2)]'
          : 'text-ink-2 hover:bg-paper-2 hover:text-ink',
      )}
    >
      <Icon name={item.key} size={21} className={on ? 'text-leaf-2' : 'text-ink-3'} />
      <span className="truncate">{t(`nav.${item.key}`)}</span>
    </Link>
  );
}

export function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-full font-bold text-[var(--c-on-leaf)] shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: 'linear-gradient(135deg, var(--c-leaf), var(--c-leaf-2))',
      }}
      aria-hidden="true"
    >
      {(name.trim()[0] ?? 'S').toUpperCase()}
    </span>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <span className="flex items-center gap-1.5 font-bold text-[17px] text-ink tnum" title={label}>
      {icon}
      <span className="sr-only">{label}: </span>
      {value.toLocaleString('en-US')}
    </span>
  );
}

const GROUP_ICON: Record<NavGroup['key'], string> = {
  main: 'dashboard',
  practice: 'practicePlayer',
  materials: 'cards',
  me: 'progress',
};

/** A folded group (Дасгал, Материал): one row that opens to show its pages. */
function FoldGroup({
  group,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  onNavigate?: () => void;
}) {
  const t = useT('common');
  const inside = group.items.some((i) => isActive(pathname, i.href));
  const [open, setOpen] = useState(inside);
  const id = `nav-${group.key}`;
  return (
    <div className="grid gap-0.5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex items-center gap-3 h-11 px-3.5 rounded-2xl text-[14.5px] font-semibold transition-colors text-left',
          inside && !open ? 'bg-sage text-leaf-2' : 'text-ink-2 hover:bg-paper-2 hover:text-ink',
        )}
      >
        <Icon name={GROUP_ICON[group.key]} size={21} className={inside ? 'text-leaf-2' : 'text-ink-3'} />
        <span className="flex-1 truncate">{t(`nav.groups.${group.key}`)}</span>
        <Icon
          name="chevron"
          size={17}
          className={cn('text-ink-3 transition-transform', open && 'rotate-90')}
        />
      </button>
      {open && (
        <div id={id} className="grid gap-0.5 ml-[26px] pl-2.5 border-l border-line sheet-in">
          {group.items.map((item) => (
            <NavLink key={item.key} item={item} pathname={pathname} onClick={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavGroups({
  pathname,
  skipMobile = false,
  onNavigate,
}: {
  pathname: string;
  skipMobile?: boolean;
  onNavigate?: () => void;
}) {
  const t = useT('common');
  return (
    <>
      {NAV.map((g) => {
        const items = skipMobile ? g.items.filter((i) => !i.mobile) : g.items;
        if (!items.length) return null;
        if (g.collapsible)
          return <FoldGroup key={g.key} group={g} pathname={pathname} onNavigate={onNavigate} />;
        return (
          <div key={g.key} className="grid gap-0.5">
            {t(`nav.groups.${g.key}`) && (
              <div className="px-3.5 mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
                {t(`nav.groups.${g.key}`)}
              </div>
            )}
            {items.map((item) => (
              <NavLink key={item.key} item={item} pathname={pathname} onClick={onNavigate} />
            ))}
          </div>
        );
      })}
    </>
  );
}

export function AppShell({ children, user }: { children: ReactNode; user?: ShellUser }) {
  const t = useT('common');
  const pathname = usePathname() ?? '/';
  const [more, setMore] = useState(false);
  const all = NAV.flatMap((g) => g.items);
  const tabs = all.filter((i) => i.mobile);
  const me: ShellUser = user ?? { name: '', level: 1, xp: 0, streak: 0 };
  const name = me.name || t('shell.guest');

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[264px_minmax(0,1fr)] shell-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] card px-4 py-2"
      >
        {t('nav.skip')}
      </a>

      {/* desktop sidebar */}
      <aside className="hidden md:flex flex-col gap-6 sticky top-0 h-dvh overflow-y-auto scroll-thin border-r border-line bg-paper/80 backdrop-blur px-4 pt-6 pb-4">
        <Link href={routes.dashboard} className="px-2.5 pb-1">
          <Logo tagline={t('shell.tagline')} />
        </Link>
        <nav className="grid gap-3" aria-label="Suprep">
          <NavGroups pathname={pathname} />
        </nav>

        <div className="mt-auto grid gap-3">
          <div className="rounded-3xl bg-sage p-4 grid gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center size-9 rounded-full bg-paper text-leaf-2">
                <Icon name="mock" size={19} />
              </span>
              <span className="font-bold text-leaf-2">{t('shell.promo.title')}</span>
            </div>
            <p className="text-[13px] leading-snug text-ink-2">{t('shell.promo.body')}</p>
            <Link
              href={routes.mock}
              className="grid place-items-center h-10 rounded-2xl bg-leaf text-[var(--c-on-leaf)] font-bold text-[14px] shadow-[0_8px_18px_-8px_var(--c-leaf)] hover:brightness-105"
            >
              {t('shell.promo.cta')}
            </Link>
          </div>
          <div className="rounded-3xl border border-line bg-paper p-3 grid gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={name} />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-ink truncate">{name}</div>
                <div className="text-[13px] text-ink-3">{t('shell.level', { n: me.level })}</div>
              </div>
              <Icon name="settings" size={20} className="text-ink-3" />
            </div>
            <ThemeToggle className="w-full [&>button]:flex-1 [&>button]:px-1" />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        {/* top bar */}
        <header className="sticky top-0 z-30 gutter py-3 md:py-5 flex items-center gap-4 bg-[color-mix(in_srgb,var(--c-bg)_82%,transparent)] backdrop-blur-md">
          <Link href={routes.dashboard} className="md:hidden" aria-label="Suprep">
            <Logo compact />
          </Link>
          <form action="/bank" role="search" className="hidden md:flex flex-1 max-w-[460px]">
            <label className="flex items-center gap-3 w-full h-12 px-4 rounded-2xl bg-paper border border-line shadow-[0_6px_20px_-14px_rgba(12,40,22,.35)] focus-within:border-leaf">
              <Icon name="search" size={20} className="text-ink-3" />
              <span className="sr-only">{t('shell.search')}</span>
              <input
                name="q"
                type="search"
                placeholder={t('shell.search')}
                className="flex-1 bg-transparent outline-none text-[15px] min-w-0"
              />
            </label>
          </form>
          <div className="ml-auto flex items-center gap-4 md:gap-7">
            <Stat icon={<Flame />} value={me.streak} label={t('shell.streak', { n: me.streak })} />
            <Stat icon={<Gem />} value={me.xp} label={t('shell.xp')} />
            <button
              type="button"
              onClick={() => toast(t('shell.empty'))}
              className="relative grid place-items-center size-10 rounded-full text-ink hover:bg-paper"
              aria-label={t('shell.notifications')}
            >
              <Icon name="bell" size={23} />
              <span className="absolute top-2 right-2.5 size-2 rounded-full bg-danger ring-2 ring-[var(--c-bg)]" />
            </button>
          </div>
        </header>

        {/* biome-ignore lint/correctness/useUniqueElementIds: the app shell renders once; #main is the skip-link target */}
        <main id="main" className="min-w-0 gutter pt-2 pb-28 md:pb-10 w-full max-w-[1320px]">
          {children}
        </main>
      </div>

      {/* phone bottom nav */}
      <nav
        aria-label="Suprep"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-1 border-t border-line bg-paper px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]"
      >
        {tabs.map((item) => {
          const on = isActive(pathname, item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'grid place-items-center gap-0.5 h-14 rounded-2xl text-[10.5px] font-bold text-center leading-tight px-1',
                on ? 'bg-sage text-leaf-2' : 'text-ink-3',
              )}
            >
              <Icon name={item.key} size={21} />
              <span className="truncate max-w-full">{t(`nav.${item.key}`)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMore(true)}
          className="grid place-items-center gap-0.5 h-14 rounded-2xl text-[10.5px] font-bold text-ink-3"
        >
          <Icon name="more" size={21} />
          {t('nav.more')}
        </button>
      </nav>

      <Sheet open={more} onClose={() => setMore(false)} label={t('nav.more')}>
        <div className="grid gap-1">
          <NavGroups pathname={pathname} skipMobile onNavigate={() => setMore(false)} />
        </div>
        <ThemeToggle className="mt-5" />
      </Sheet>
    </div>
  );
}
