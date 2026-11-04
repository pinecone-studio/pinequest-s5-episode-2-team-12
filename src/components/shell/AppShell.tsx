'use client';
// App frame: a slim top bar (SAT chip · avatar) and the navigation. From md up the navigation is a rail that stays
// on screen — icons only, widening smoothly to show labels; below md it is the ☰ drawer. On the map (variant "map")
// the bar floats transparently over a full-screen <main>; other pages get a solid bar and the usual gutter.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type CSSProperties, type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { Logo } from '@/components/brand';
import { Avatar } from '@/components/brand/Avatar';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { useDialog } from '@/components/ui/useDialog';
import type { SettingsPatch } from '@/features/settings/actions';
import { readLocalSettings } from '@/features/settings/local';
import type { StudentSettings } from '@/features/settings/use-settings';
import type { AccessorySlot } from '@/features/shop/catalog';
import { useWallet } from '@/features/shop/lib/use-wallet';
import type { ServerWallet } from '@/features/shop/queries';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { ADMIN_NAV, isActive, NAV, type NavGroup, type NavItem } from '@/lib/nav';
import { routes } from '@/lib/routes';
import { ExamChip } from './ExamChip';
import { Flame, Icon } from './icons';
import { useSidebar } from './sidebar-state';

export type ShellUser = {
  name: string;
  level: number;
  xp: number;
  streak: number;
  avatarId?: string;
  /** profiles.role = 'admin': the drawer adds the Admin link. */
  admin?: boolean;
};

type UserLook = {
  frame?: string;
  outfit?: string;
  accessories?: Partial<Record<AccessorySlot, string>>;
};
export { Avatar };

function NavLink({
  item,
  pathname,
  rail = false,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  rail?: boolean;
  /** Called when the link is chosen, so the drawer or rail can close. */
  onNavigate?: () => void;
}) {
  const t = useT('common');
  const on = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      aria-current={on ? 'page' : undefined}
      title={rail ? t(`nav.${item.key}`) : undefined}
      onClick={onNavigate}
      className={cn(
        'workspace-nav-link flex items-center gap-3 h-11 px-3.5 rounded-2xl text-[14.5px] font-semibold transition-colors',
        on
          ? 'bg-sage text-leaf-2 shadow-[inset_0_0_0_1px_var(--c-sage-2)]'
          : 'text-ink-2 hover:bg-paper-2 hover:text-ink',
      )}
    >
      <Icon name={item.key} size={21} className={cn('shrink-0', on ? 'text-leaf-2' : 'text-ink-3')} />
      <span className="rail-label truncate">{t(`nav.${item.key}`)}</span>
    </Link>
  );
}

/** A folded group (Материал): one row that opens to show its pages. */
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
            <NavLink key={item.key} item={item} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

/** The page links, shared by the drawer and the rail. In the rail folded groups are listed flat (no labels to fold). */
function NavList({
  pathname,
  rail = false,
  admin = false,
  onNavigate,
}: {
  pathname: string;
  rail?: boolean;
  admin?: boolean;
  onNavigate?: () => void;
}) {
  const t = useT('common');
  return (
    <nav className="grid gap-3" aria-label="Suprep">
      {(admin ? [...NAV, ADMIN_NAV] : NAV).map((g) =>
        g.collapsible && !rail ? (
          <FoldGroup key={g.key} group={g} pathname={pathname} onNavigate={onNavigate} />
        ) : (
          <div key={g.key} className="grid gap-0.5">
            {t(`nav.groups.${g.key}`) && (
              <div className="rail-label rail-group px-3.5 mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
                {t(`nav.groups.${g.key}`)}
              </div>
            )}
            {g.items.map((item) => (
              <NavLink key={item.key} item={item} pathname={pathname} rail={rail} onNavigate={onNavigate} />
            ))}
          </div>
        ),
      )}
    </nav>
  );
}

/** Profile card and theme switch at the bottom of the drawer and the rail. */
function NavFooter({
  user,
  gems,
  look,
  onNavigate,
}: {
  user: ShellUser;
  gems: number;
  look: UserLook;
  onNavigate?: () => void;
}) {
  const t = useT('common');
  const name = user.name || t('shell.guest');
  return (
    <div className="mt-auto grid gap-3">
      <Link
        href={routes.profile}
        title={name}
        onClick={onNavigate}
        className="rail-profile flex items-center gap-3 rounded-3xl border border-line bg-paper p-3 hover:border-leaf"
      >
        <span className="shrink-0">
          <Avatar name={name} avatarId={user.avatarId} {...look} />
        </span>
        <span className="rail-label min-w-0 flex-1">
          <span className="block font-bold text-ink truncate">{name}</span>
          <span className="block text-[13px] text-ink-3">
            {t('shell.level', { n: user.level })} · 💎 <span className="tnum">{gems}</span>
            <span className="sr-only"> {t('shell.gems')}</span>
          </span>
        </span>
        <span
          className="rail-label flex items-center gap-1 font-bold text-ink tnum"
          title={t('shell.streak', { n: user.streak })}
        >
          <Flame size={18} />
          <span className="sr-only">{t('shell.streak', { n: user.streak })}</span>
          <span aria-hidden="true">{user.streak}</span>
        </span>
      </Link>
      <div className="rail-extra">
        <ThemeToggle className="w-full [&>button]:flex-1 [&>button]:px-1" />
      </div>
    </div>
  );
}

/** Desktop (md+) navigation: always on screen; `expanded` widens it from icons to icons + labels. */
function NavRail({
  id,
  expanded,
  onToggle,
  onCollapse,
  user,
  pathname,
  gems,
  look,
}: {
  id: string;
  expanded: boolean;
  onToggle: () => void;
  /** Choosing a page closes the rail back to icons. */
  onCollapse: () => void;
  user: ShellUser;
  pathname: string;
  gems: number;
  look: UserLook;
}) {
  const t = useT('common');
  return (
    <>
      <aside
        id={id}
        aria-label={t('nav.menu')}
        data-expanded={expanded ? 'true' : 'false'}
        className="workspace-drawer workspace-rail fixed inset-y-0 left-0 z-40 hidden md:flex flex-col gap-5 overflow-y-auto overflow-x-hidden scroll-thin bg-paper px-3 pb-4"
      >
        <div className="rail-head flex items-center justify-between gap-2">
          <Link href={routes.home} aria-label="Suprep" className="rail-logo block min-w-0">
            <Logo tagline={t('shell.tagline')} />
          </Link>
          {expanded && (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded
              aria-controls={id}
              aria-label={t('nav.collapseMenu')}
              title={t('nav.collapseMenu')}
              className="rail-close grid place-items-center size-10 shrink-0 rounded-full text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              <Icon name="close" size={20} />
            </button>
          )}
        </div>
        <NavList pathname={pathname} rail admin={user.admin} onNavigate={onCollapse} />
        <NavFooter user={user} gems={gems} look={look} onNavigate={onCollapse} />
      </aside>
      {/* Opens the rail; once open, the × in its header closes it. */}
      {!expanded && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={false}
          aria-controls={id}
          aria-label={t('nav.expandMenu')}
          title={t('nav.expandMenu')}
          className="workspace-rail-toggle fixed z-[45] hidden md:grid place-items-center"
        >
          <Icon name="chevron" size={16} />
        </button>
      )}
    </>
  );
}

function NavDrawer({
  id,
  open,
  onClose,
  user,
  pathname,
  gems,
  look,
}: {
  id: string;
  open: boolean;
  onClose: () => void;
  user: ShellUser;
  pathname: string;
  gems: number;
  look: UserLook;
}) {
  const t = useT('common');
  const ref = useRef<HTMLDivElement>(null);
  useDialog(open, ref, onClose);
  return (
    <div className={cn('fixed inset-0 z-50 md:hidden', !open && 'hidden')}>
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--c-forest)_45%,transparent)]"
      />
      <div
        ref={ref}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label={t('nav.menu')}
        tabIndex={-1}
        className="workspace-drawer absolute inset-y-0 left-0 w-[300px] max-w-[86vw] flex flex-col gap-5 overflow-y-auto scroll-thin bg-paper border-r-[1.5px] border-line shadow-pop rounded-r-[28px] px-4 pt-5 pb-[max(16px,env(safe-area-inset-bottom))]"
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

        <NavList pathname={pathname} admin={user.admin} onNavigate={onClose} />
        <NavFooter user={user} gems={gems} look={look} onNavigate={onClose} />
      </div>
    </div>
  );
}

export function AppShell({
  children,
  user,
  settings,
  demo,
  wallet = null,
  variant = 'page',
}: {
  children: ReactNode;
  user?: ShellUser;
  settings: StudentSettings;
  demo: boolean;
  wallet?: ServerWallet | null;
  variant?: 'map' | 'page';
}) {
  const t = useT('common');
  const roadmapT = useT('roadmap');
  const pathname = usePathname() ?? '/';
  const { open, setOpen, expanded, setExpanded } = useSidebar();
  const closeSidebar = useCallback(() => setOpen(false), [setOpen]);
  const toggleRail = useCallback(() => setExpanded(!expanded), [expanded, setExpanded]);
  const collapseRail = useCallback(() => setExpanded(false), [setExpanded]);
  // From md up the rail replaces the drawer: close a drawer left open on a narrower window.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px)');
    const sync = () => wide.matches && setOpen(false);
    sync();
    wide.addEventListener('change', sync);
    return () => wide.removeEventListener('change', sync);
  }, [setOpen]);
  const drawerId = useId();
  const railId = useId();
  const [localAvatar, setLocalAvatar] = useState<string | undefined>(undefined);
  useEffect(() => {
    setLocalAvatar(demo ? readLocalSettings().avatarId : undefined);
    const changed = (event: Event) => {
      const patch = (event as CustomEvent<SettingsPatch>).detail;
      if (patch.avatarId !== undefined) setLocalAvatar(patch.avatarId);
    };
    window.addEventListener('suprep-settings', changed);
    return () => window.removeEventListener('suprep-settings', changed);
  }, [demo]);
  const me: ShellUser = {
    ...(user ?? { name: '', level: 1, xp: 0, streak: 0 }),
    ...(localAvatar !== undefined && { avatarId: localAvatar }),
  };

  const map = variant === 'map';
  const w = useWallet(demo, wallet);
  const look: UserLook = {
    frame: w.equipped.frame,
    outfit: w.equipped.outfit,
    accessories: { head: w.equipped.head, eyes: w.equipped.eyes, neck: w.equipped.neck },
  };

  return (
    <div
      className={cn('app-frame min-h-dvh', !map && 'shell-bg emerald-workspace')}
      data-rail={expanded ? 'expanded' : 'collapsed'}
      style={{ '--rail-w': expanded ? '272px' : '76px' } as CSSProperties}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] card px-4 py-2"
      >
        {t('nav.skip')}
      </a>

      <NavRail
        id={railId}
        expanded={expanded}
        onToggle={toggleRail}
        onCollapse={collapseRail}
        user={me}
        pathname={pathname}
        gems={w.balance}
        look={look}
      />

      <NavDrawer
        id={drawerId}
        open={open}
        onClose={closeSidebar}
        user={me}
        pathname={pathname}
        gems={w.balance}
        look={look}
      />

      {/* From md up the bar and the page sit in one rounded panel beside the rail (its own scroll area). */}
      <div className="app-panel">
        <header
          style={
            map
              ? {
                  borderBottom: `1px solid ${w.equipped.skin === 'skin-night' ? 'rgba(255,255,255,0.18)' : 'var(--c-line)'}`,
                  backgroundColor: 'transparent',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                }
              : undefined
          }
          className={cn(
            'z-30 gutter py-3 flex items-center gap-3',
            !map && 'workspace-topbar',
            map
              ? 'app-offset fixed md:absolute inset-x-0 top-0 h-(--topbar-h) pointer-events-none [&>*]:pointer-events-auto'
              : 'sticky top-0 bg-[color-mix(in_srgb,var(--c-bg)_82%,transparent)] backdrop-blur-md',
          )}
        >
          <button
            type="button"
            aria-label={t('nav.menu')}
            aria-expanded={open}
            aria-controls={drawerId}
            onClick={() => setOpen(true)}
            className="md:hidden grid place-items-center size-11 rounded-full bg-paper/90 backdrop-blur border border-line text-ink hover:border-leaf"
          >
            <Icon name="menu" size={22} />
          </button>
          <Link
            href={routes.home}
            aria-label="Suprep"
            className={map ? 'hidden sm:block md:hidden' : 'block md:hidden'}
          >
            <Logo light={map && w.equipped.skin === 'skin-night'} />
          </Link>
          {map && (
            <div
              className="hidden md:flex"
              style={{
                justifyContent: 'flex-start',
                alignItems: 'center',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                color: w.equipped.skin === 'skin-night' ? '#fff' : 'var(--c-leaf-ink)',
                fontSize: 'clamp(16px, 1.4vw, 20px)',
                fontFamily: 'var(--font-oranienbaum), Georgia, serif',
                fontWeight: 400,
                letterSpacing: '.05em',
              }}
            >
              {roadmapT('heading.title')}
            </div>
          )}
          <div className="ml-auto flex items-center gap-2.5">
            <ExamChip initial={settings} demo={demo} />
            {/* no viewport prefetch: on the map home its bytes would compete with the first paint */}
            <Link
              href={routes.profile}
              prefetch={false}
              aria-label={t('shell.profile')}
              className="flex size-10 shrink-0 items-center justify-center rounded-full ring-2 ring-paper/80 hover:ring-leaf"
            >
              <Avatar name={me.name || t('shell.guest')} avatarId={me.avatarId} size={40} {...look} />
            </Link>
          </div>
        </header>

        {/* biome-ignore lint/correctness/useUniqueElementIds: the app shell renders once; #main is the skip-link target */}
        <main
          id="main"
          className={cn(
            map
              ? 'app-offset fixed md:absolute inset-0'
              : 'min-w-0 gutter pt-4 pb-12 w-full max-w-[1280px] mx-auto',
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
