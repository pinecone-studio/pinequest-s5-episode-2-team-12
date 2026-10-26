/** SAT Math content domains (share of the Math section). */
export type Domain = 'alg' | 'adv' | 'psda' | 'geo';

export type Question = {
  id: string;
  domain: Domain;
  skill: string;
  difficulty: 1 | 2 | 3;
  /** English, as on the SAT. Inline math in $…$. */
  prompt: string;
  /** Mongolian gloss for tricky vocabulary. */
  mn?: string;
  /** Present for multiple choice; absent for grid-in. */
  choices?: string[];
  /** Index into `choices` for MCQ, or accepted strings for grid-in. */
  answer: number | string[];
  explain: string;
  hint: string;
  /** Desmos rows that solve it. A row "TABLE:x,y;x,y" is a table, ";R" turns on regression. */
  desmos?: { rows: string[]; tip: string };
  /** Misconception shown for a wrong choice index. */
  why?: Record<number, string>;
  similar?: string;
  vocab?: string[];

  /* ——— roadmap («Монголын аялал») bank; optional so the practice bank stays valid ——— */
  /** Roadmap topic 1–26 (src/features/roadmap/topics.ts). */
  topicId?: number;
  /** 'spr' = student-produced response (grid-in). Implied by `choices` when absent. */
  format?: 'mcq' | 'spr';
  /** 'placement' items are only served in the placement test, never in a stop. */
  pool?: 'stop' | 'placement';
  /** Only reviewed questions are served in production. */
  reviewed?: boolean;
  source?: 'original';
  author?: string;
  /** ISO date. */
  createdAt?: string;
  /** Inline SVG markup or an image path under /public. */
  figure?: string;
};

export type QuestionFilter = {
  domain?: Domain;
  difficulty?: 1 | 2 | 3;
  desmosOnly?: boolean;
  search?: string;
};
