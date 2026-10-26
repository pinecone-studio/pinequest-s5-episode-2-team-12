// Database rows ↔ duel types (server-side mapping, shared by actions and queries).
import type { Duel, Run } from './lib/duel';

export type DuelRow = {
  id: string;
  challenger: string;
  opponent: string;
  topic_id: number | null;
  size: 5 | 10;
  question_ids: string[];
  time_limit_ms: number;
  created_at: string;
  expires_at: string;
  mode: 'async' | 'live';
};
export type RunRow = {
  user_id: string;
  started_at: string;
  served_at: string;
  answers: Run['answers'];
  finished_at: string | null;
  correct: number;
  time_ms: number;
  flagged: boolean;
};

export const duelFromRow = (r: DuelRow): Duel => ({
  id: r.id,
  challenger: r.challenger,
  opponent: r.opponent,
  topicId: r.topic_id,
  size: r.size,
  ids: r.question_ids,
  timeLimitMs: r.time_limit_ms,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  mode: r.mode,
});

export const runFromRow = (r: RunRow): Run => ({
  userId: r.user_id,
  startedAt: r.started_at,
  servedAt: r.served_at,
  answers: r.answers ?? [],
  finishedAt: r.finished_at,
  correct: r.correct,
  timeMs: r.time_ms,
  flagged: r.flagged,
});
