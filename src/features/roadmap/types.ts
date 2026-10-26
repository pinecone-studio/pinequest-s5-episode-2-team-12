// Roadmap («Монголын аялал») contracts. Shared only inside features/roadmap; the question fields it adds
// to the bank live in src/types/question.ts.
import type { Domain } from '@/types';

export type RegionId = 'west' | 'khangai' | 'gobi' | 'east' | 'north' | 'central';

export type Stop = {
  /** 1–26, route order. Stop N teaches topic N. */
  no: number;
  /** UI label: the center city ("Ховд", "Эрдэнэт"). */
  place: string;
  /** Aimag (small label) or a note ("Улаанбаатар (дүүрэг)"). */
  aimag: string;
  region: RegionId;
  lat: number;
  lng: number;
  /** Screen-space nudge (px) for the label/card so the Ulaanbaatar cluster does not overlap. */
  offset?: [number, number];
};

export type CbDomain =
  | 'Algebra'
  | 'Problem-Solving and Data Analysis'
  | 'Advanced Math'
  | 'Geometry and Trigonometry';

export type Topic = {
  id: number;
  /** Mongolian title (draft, editable). */
  title: string;
  cbDomain: CbDomain;
  cbSkill: string;
  domain: Domain;
  /** Glyph key for TopicIcon. */
  icon: string;
};

export type Region = { id: RegionId; title: string; badge: string };

/** Overall placement level. UI: Сул / Дунд / Сайн. */
export type PlacementLevel = 'weak' | 'mid' | 'strong';
/** Per-topic mastery from the placement test. */
export type Mastery = 'weak' | 'ok' | 'strong';
export type Difficulty = 'easy' | 'medium' | 'hard';

export type StopStatus = 'locked' | 'available' | 'current' | 'completed' | 'tested-out';

export type StopProgress = {
  no: number;
  /** Best share correct 0..1 over attempts. */
  best: number;
  stars: 0 | 1 | 2 | 3;
  attempts: number;
  testedOut: boolean;
  /** ISO timestamp, set when passed or tested out. */
  completedAt: string | null;
};

export type PlacementAnswer = { qid: string; answer: string; correct: boolean; timeMs: number };

export type PlacementResult = {
  /** True when the student skipped the test (level = mid). */
  skipped: boolean;
  module2: 'easy' | 'hard' | null;
  /** Weighted score 0..1. */
  score: number;
  level: PlacementLevel;
  mastery: Record<number, Mastery>;
  answers: PlacementAnswer[];
  finishedAt: string;
};

export type RoadmapState = {
  placement: PlacementResult | null;
  /** Effective mastery per topic (placement, updated by retakes for unfinished stops). */
  mastery: Record<number, Mastery>;
  level: PlacementLevel;
  stops: StopProgress[];
  /** Region ids whose badge was awarded. */
  regionsDone: RegionId[];
};

/** One answered problem, for selection history and analytics. */
export type ProblemAttempt = {
  qid: string;
  topicId: number;
  correct: boolean;
  hintUsed: boolean;
  timeMs: number;
  at: number;
};
