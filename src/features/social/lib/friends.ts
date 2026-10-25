// Friends, privacy and safety rules. Pure (social.test.ts); Postgres mirrors them in the leaderboard RPC.
// What others may see of a student: display name, avatar, level. Never email, phone, school or location.

/** No 0/O, 1/I/L — codes are read aloud and typed on phones. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 8;

export function makeFriendCode(random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return s;
}

/** Normalizes what a student typed («abcd-2345», spaces) into a code, or null if it cannot be one. */
export function parseFriendCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[\s-]/g, '');
  if (s.length !== CODE_LENGTH) return null;
  return [...s].every((c) => CODE_ALPHABET.includes(c)) ? s : null;
}

export const formatFriendCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** Friendships are stored once per pair, smaller id first. */
export function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export type Privacy = { hidePublic: boolean; friendsOnly: boolean };
export type Relation = { friends: boolean; blocked: boolean };

/**
 * May `viewer` see `target` on a list (leaderboard, search)? Blocking hides both ways; «friends only»
 * hides from everyone else; «hide from public» removes the student from aimag and national boards.
 */
export function visible(
  scope: 'friends' | 'aimag' | 'national',
  privacy: Privacy,
  rel: Relation,
  self: boolean,
): boolean {
  if (self) return true;
  if (rel.blocked) return false;
  if (scope === 'friends') return rel.friends;
  if (privacy.friendsOnly) return rel.friends && !privacy.hidePublic;
  return !privacy.hidePublic;
}

/** Fixed reactions — there is no free-text chat (most students are minors). */
export const REACTIONS = ['gg', 'wow', 'nice', 'again', 'fire', 'clap'] as const;
export type Reaction = (typeof REACTIONS)[number];
export const REACTION_EMOJI: Record<Reaction, string> = {
  gg: '🤝',
  wow: '😮',
  nice: '👍',
  again: '🔁',
  fire: '🔥',
  clap: '👏',
};

export const REPORT_REASONS = ['name', 'avatar', 'cheating', 'harassment', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
