import type { Domain } from '@/types';

/** The four official SAT Math domains; each card opens that domain in the paginated official bank. */
export const BANK_TOPICS: { id: Domain; label: string }[] = [
  { id: 'alg', label: 'Алгебр' },
  { id: 'adv', label: 'Ахисан математик' },
  { id: 'psda', label: 'Өгөгдөл ба бодлого' },
  { id: 'geo', label: 'Геометр' },
];

export function bankTopicHref(topic: Domain): string {
  return `/bank?view=official&domain=${topic}`;
}
