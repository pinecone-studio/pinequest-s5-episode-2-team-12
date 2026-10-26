'use client';
// App frame: a slim top bar (☰ + logo · SAT chip · avatar) and the nav drawer. On the map (variant "map") the bar
// floats transparently over a full-screen <main>; other pages get a solid bar and the usual gutter.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Logo } from '@/components/brand';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useDialog } from '@/components/ui/useDialog';
import type { StudentSettings } from '@/features/settings/use-settings';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { isActive, NAV, type NavGroup, type NavItem } from '@/lib/nav';
import { routes } from '@/lib/routes';
import { ExamChip } from './ExamChip';
import { Flame, Icon } from './icons';

export type ShellUser = { name: string; level: number; xp: number; streak: number };

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const t = useT('common');
  const on = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
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

/** A folded group (Материал): one row that opens to show its pages. */
function FoldGroup({ group, pathname }: { group: NavGroup; pathname: string }) {
  const t = useT('common');
  const inside = group.items.some((i) => isActive(pathname, i.href));
  const [open, setOpen] = useState(inside);
  const id = useId();
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
        <Icon name="cards" size={21} className={inside ? 'text-leaf-2' : 'text-ink-3'} />
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
            <NavLink key={item.key} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

function NavDrawer({
  id,
  open,
  onClose,
  user,
  pathname,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  user: ShellUser;
  pathname: string;
}) {
  const t = useT('common');
  const ref = useRef<HTMLDivElement>(null);
  useDialog(open, ref, onClose);
  const name = user.name || t('shell.guest');
  return (
    <div className={cn('fixed inset-0 z-50', !open && 'hidden')}>
      <button
        type="button"
        aria-label={t('nav.closeMenu')}
        tabIndex={-1}
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--c-forest)_45%,transparent)] cursor-default"
        onClick={onClose}
      />
      <div
        ref={ref}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.menu')}
        tabIndex={-1}
        className="drawer-in absolute inset-y-0 left-0 w-[300px] max-w-[86vw] flex flex-col gap-5 overflow-y-auto scroll-thin bg-paper border-r-[1.5px] border-line shadow-pop rounded-r-[28px] px-4 pt-5 pb-[max(16px,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-center justify-between px-1">
          <Link href={routes.home} aria-label="Suprep">
            <Logo tagline={t('shell.tagline')} />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('nav.closeMenu')}
            className="grid place-items-center size-10 rounded-full text-ink-2 hover:bg-paper-2"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <nav className="grid gap-3" aria-label="Suprep">
          {NAV.map((g) =>
            g.collapsible ? (
              <FoldGroup key={g.key} group={g} pathname={pathname} />
            ) : (
              <div key={g.key} className="grid gap-0.5">
                {t(`nav.groups.${g.key}`) && (
                  <div className="px-3.5 mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
                    {t(`nav.groups.${g.key}`)}
                  </div>
                )}
                {g.items.map((item) => (
                  <NavLink key={item.key} item={item} pathname={pathname} />
                ))}
              </div>
            ),
          )}
        </nav>

        <div className="mt-auto grid gap-3">
          <Link
            href={routes.profile}
            className="flex items-center gap-3 rounded-3xl border border-line bg-paper p-3 hover:border-leaf"
          >
            <Avatar name={name} />
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-ink truncate">{name}</span>
              <span className="block text-[13px] text-ink-3">{t('shell.level', { n: user.level })}</span>
            </span>
            <span
              className="flex items-center gap-1 font-bold text-ink tnum"
              title={t('shell.streak', { n: user.streak })}
            >
              <Flame size={18} />
              <span className="sr-only">{t('shell.streak', { n: user.streak })}</span>
              <span aria-hidden="true">{user.streak}</span>
            </span>
          </Link>
          <ThemeToggle className="w-full [&>button]:flex-1 [&>button]:px-1" />
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  user,
  settings,
  demo,
  variant = 'page',
}: {
  children: ReactNode;
  user?: ShellUser;
  settings: StudentSettings;
  demo: boolean;
  variant?: 'map' | 'page';
}) {
  const t = useT('common');
  const pathname = usePathname() ?? '/';
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const me: ShellUser = user ?? { name: '', level: 1, xp: 0, streak: 0 };
  const map = variant === 'map';

  // navigating closes the drawer
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className={cn('min-h-dvh', !map && 'shell-bg')}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] card px-4 py-2"
      >
        {t('nav.skip')}
      </a>

      <header
        className={cn(
          'z-30 gutter py-3 flex items-center gap-3',
          map
            ? 'fixed inset-x-0 top-0 pointer-events-none [&>*]:pointer-events-auto'
            : 'sticky top-0 bg-[color-mix(in_srgb,var(--c-bg)_82%,transparent)] backdrop-blur-md',
        )}
      >
        <button
          type="button"
          aria-label={t('nav.menu')}
          aria-expanded={open}
          aria-controls={drawerId}
          onClick={() => setOpen(true)}
          className="grid place-items-center size-11 rounded-full bg-paper/90 backdrop-blur border border-line text-ink hover:border-leaf"
        >
          <Icon name="menu" size={22} />
        </button>
        <Link href={routes.home} aria-label="Suprep" className="hidden sm:block">
          <Logo compact />
        </Link>
        <div className="ml-auto flex items-center gap-2.5">
          <ExamChip initial={settings} demo={demo} />
          <Link
            href={routes.profile}
            aria-label={t('shell.profile')}
            className="rounded-full ring-2 ring-paper/80 hover:ring-leaf"
          >
            <Avatar name={me.name || t('shell.guest')} size={40} />
          </Link>
        </div>
      </header>

      <NavDrawer id={drawerId} open={open} onClose={() => setOpen(false)} user={me} pathname={pathname} />

      {/* biome-ignore lint/correctness/useUniqueElementIds: the app shell renders once; #main is the skip-link target */}
      <main
        id="main"
        className={cn(map ? 'fixed inset-0' : 'min-w-0 gutter pt-2 pb-12 w-full max-w-[1320px] mx-auto')}
      >
        {children}
      </main>
    </div>
  );
}
