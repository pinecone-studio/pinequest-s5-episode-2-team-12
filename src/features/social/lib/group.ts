// Group mock exam: one student schedules it and invites friends; everyone gets the same frozen form (no
// adaptive switch, so the forms match), the same order and the same clock anchored to the start time —
// nobody can pause or start late on their own timer. The board opens when the window closes. Pure.
import { MOCK } from '@/features/exam/config';
import { buildModule } from '@/features/exam/lib/mock';
import { seeded } from '@/features/roadmap/lib/select-problems';
import type { Question } from '@/types';

const MIN = 60_000;
/** Module 1, break, module 2, plus a few minutes to send the last answers. */
export const GROUP_WINDOW_MS = (MOCK.moduleMinutes * 2 + MOCK.breakMinutes + 5) * MIN;
export const GROUP = { maxMembers: 30, minLeadMs: 5 * MIN, maxLeadMs: 14 * 24 * 60 * MIN };

export type GroupSession = {
  id: string;
  host: string;
  startsAt: string;
  closesAt: string;
  module1: string[];
  module2: string[];
  members: string[];
};

export function makeGroupForm(
  pool: readonly Question[],
  seed: number,
): { module1: string[]; module2: string[] } {
  const rng = seeded(seed);
  const module1 = buildModule({ pool, mix: MOCK.mix.module1, rng });
  const module2 = buildModule({
    pool,
    mix: { easy: 0.3, medium: 0.4, hard: 0.3 },
    exclude: new Set(module1),
    rng,
  });
  return { module1, module2 };
}

export function groupState(
  s: Pick<GroupSession, 'startsAt' | 'closesAt'>,
  now: number,
): 'scheduled' | 'open' | 'closed' {
  if (now < Date.parse(s.startsAt)) return 'scheduled';
  return now < Date.parse(s.closesAt) ? 'open' : 'closed';
}

/** Deadlines everyone shares: module 1 ends 35 min after the start, module 2 begins after the break. */
export function groupClock(startsAt: string) {
  const t0 = Date.parse(startsAt);
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
    module1: { startedAt: iso(t0), endsAt: iso(t0 + MOCK.moduleMinutes * MIN) },
    module2: {
      startedAt: iso(t0 + (MOCK.moduleMinutes + MOCK.breakMinutes) * MIN),
      endsAt: iso(t0 + (MOCK.moduleMinutes * 2 + MOCK.breakMinutes) * MIN),
    },
  };
}

/** Validates a requested start: not too soon (friends need notice), not too far ahead. */
export function startOk(startsAt: number, now: number): boolean {
  return startsAt - now >= GROUP.minLeadMs && startsAt - now <= GROUP.maxLeadMs;
}
