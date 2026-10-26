// Drawer structure (☰). Labels are keys in src/messages/*.json → nav.*
import { routes } from './routes';

export type NavItem = { key: string; href: string; section: string };
export type NavGroup = {
  key: 'main' | 'materials' | 'me';
  items: NavItem[];
  /** Folded under its title; opens on click. */
  collapsible?: boolean;
};

export const NAV: NavGroup[] = [
  {
    key: 'main',
    items: [
      { key: 'map', href: routes.home, section: 'A' },
      { key: 'practicePlayer', href: routes.practice(), section: 'C' },
      { key: 'mock', href: routes.mock, section: 'D' },
      { key: 'tutor', href: routes.tutor(), section: 'G' },
      { key: 'flashcards', href: routes.flashcards, section: 'E' },
      { key: 'mistakes', href: routes.mistakes, section: 'D' },
      { key: 'daily', href: routes.daily, section: 'C' },
      { key: 'friends', href: routes.friends, section: 'F' },
      { key: 'leaderboard', href: routes.leaderboard, section: 'F' },
      { key: 'shop', href: routes.shop, section: 'F' },
      { key: 'planner', href: routes.planner, section: 'I' },
    ],
  },
  {
    key: 'materials',
    collapsible: true,
    items: [
      { key: 'desmos', href: routes.desmosHome, section: 'B' },
      { key: 'journey', href: routes.journey, section: 'A' },
      { key: 'bank', href: routes.bank(), section: 'C' },
      { key: 'hard', href: routes.hard, section: 'C' },
      { key: 'help', href: routes.help, section: 'I' },
    ],
  },
  {
    key: 'me',
    items: [
      { key: 'achievements', href: routes.achievements, section: 'F' },
      { key: 'settings', href: routes.settings, section: 'I' },
    ],
  },
];

/** Active when the path is the item or below it (/cards/ops → cards). Home is active only on itself. */
export function isActive(pathname: string, href: string): boolean {
  const base = href.split('?')[0];
  if (base === '/') return pathname === '/';
  return pathname === base || pathname.startsWith(`${base}/`);
}
