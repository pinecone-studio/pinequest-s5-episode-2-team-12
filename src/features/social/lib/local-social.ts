'use client';
// Demo mode social state: demo friends (bots), requests, blocks and duels in localStorage.
import { BOTS } from './bots';
import type { Duel, Run } from './duel';

export type LocalDuel = { duel: Duel; mine: Run | null; theirs: Run; reactions: string[] };
export type LocalSocial = {
  code: string;
  friends: string[];
  incoming: string[];
  outgoing: string[];
  blocked: string[];
  duels: LocalDuel[];
};

const KEY = 'suprep:social:v1';

const initial = (): LocalSocial => ({
  code: 'DEMQ2345',
  friends: [BOTS[0].id, BOTS[1].id],
  incoming: [BOTS[3].id],
  outgoing: [],
  blocked: [],
  duels: [],
});

export function loadSocial(): LocalSocial {
  if (typeof window === 'undefined') return initial();
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...initial(), ...(JSON.parse(raw) as Partial<LocalSocial>) } : initial();
  } catch {
    return initial();
  }
}

export function saveSocial(s: LocalSocial) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new Event('suprep-social'));
  } catch {
    // storage blocked
  }
}

/** A demo duel: the bot's run comes from the server (it has the answers), the student plays theirs. */
export function addLocalDuel(s: LocalSocial, duel: Duel, theirs: Run): LocalSocial {
  return { ...s, duels: [{ duel, mine: null, theirs, reactions: [] }, ...s.duels] };
}
