'use client';
// Weak placement topics for the AI planner. Client hook because demo mode keeps the roadmap in localStorage.
import { isOpen } from '../lib/state';
import { topicById } from '../topics';
import type { RoadmapState } from '../types';
import { useRoadmapState } from './store';

type Props = { demo: boolean; server: RoadmapState | null };

/**
 * Weak topics from the placement test for the AI planner: `ids` (from ?weak=) when given, otherwise the
 * topics the placement marked «weak». Titles in Mongolian.
 */
export function usePlacementWeak(p: Props & { ids: number[] }): string[] {
  const { state, ready } = useRoadmapState(p.demo, p.server);
  const open = ready && isOpen(state);
  const ids = p.ids.length
    ? p.ids
    : open && state.placement && !state.placement.skipped
      ? Object.entries(state.mastery)
          .filter(([, m]) => m === 'weak')
          .map(([k]) => Number(k))
          .slice(0, 3)
      : [];
  return ids.map((id) => topicById(id)?.title).filter((x): x is string => Boolean(x));
}
