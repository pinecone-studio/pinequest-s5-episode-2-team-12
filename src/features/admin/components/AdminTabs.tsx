'use client';
// Sub-navigation shared by every /admin page (rendered by the admin layout).
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/shell/icons';
import { cn } from '@/lib/cn';
import { useT } from '@/lib/i18n-client';
import { isActive } from '@/lib/nav';
import { routes } from '@/lib/routes';

const TABS = [
  { key: 'overview', href: routes.admin, icon: 'dashboard' },
  { key: 'users', href: routes.adminUsers(), icon: 'users' },
  { key: 'reports', href: routes.adminReports(), icon: 'flag' },
  { key: 'feedback', href: routes.adminFeedback(), icon: 'feedback' },
  { key: 'content', href: routes.adminContent, icon: 'practicePlayer' },
  { key: 'questions', href: routes.adminQuestions, icon: 'bank' },
  { key: 'flashcards', href: routes.adminFlashcards, icon: 'cards' },
] as const;

export function AdminTabs() {
  const t = useT('admin');
  const pathname = usePathname() ?? routes.admin;
  return (
    <nav aria-label={t('tabs.label')} className="soft-card flex gap-1 overflow-x-auto scroll-thin p-2">
      {TABS.map((tab) => {
        // the overview is /admin itself; every other tab owns its subtree
        const on = tab.href === routes.admin ? pathname === routes.admin : isActive(pathname, tab.href);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 h-10 px-3.5 rounded-xl text-[14px] font-semibold whitespace-nowrap transition-colors',
              on
                ? 'bg-sage text-leaf-2 shadow-[inset_0_0_0_1px_var(--c-sage-2)]'
                : 'text-ink-2 hover:bg-paper-2 hover:text-ink',
            )}
          >
            <Icon name={tab.icon} size={18} className={on ? 'text-leaf-2' : 'text-ink-3'} />
            {t(`tabs.${tab.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
