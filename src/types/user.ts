export type StartPoint = 'english' | 'foundations' | 'desmos';

export type Profile = {
  id: string;
  name: string;
  onboarded: boolean;
  /** 1–5 self-rated confidence. */
  confidence?: number;
  satExp?: 'none' | 'some' | 'taken';
  desmos?: 'never' | 'little' | 'often';
  /** Target Math score 200–800. */
  target: number;
  /** Official SAT Math score, only after taking the real test (satExp 'taken'). */
  lastMathScore?: number | null;
  /** Minutes a day the student plans to study. */
  studyMinutes?: 15 | 30 | 45 | 60;
  /** YYYY-MM-DD */
  examDate: string;
  start?: StartPoint;
  /** IANA zone for countdowns; Asia/Ulaanbaatar by default. */
  tz: string;
  /** Leave the national and aimag leaderboards. */
  hidePublic: boolean;
  /** Only friends see this student. */
  friendsOnly: boolean;
  /** Preset avatar (components/brand/avatars.ts). */
  avatarId?: string;
  /** Home aimag (lib/aimags.ts), for the aimag leaderboard. */
  aimag?: string;
  school?: string;
  age?: number;
  /** Only an admin (or the service role) can change it — see protect_profile_role in migration 0006. */
  role?: 'student' | 'admin';
};

export type TutorMode = 'hint' | 'explain' | 'desmos' | 'similar' | 'translate';
export type TutorContextKind = 'lesson' | 'desmos' | 'question' | 'mistake' | 'topic' | 'general';
export type TutorContext = {
  kind: TutorContextKind;
  id?: string;
  title: string;
  problem?: string;
  chosen?: string;
  /** A bank problem: what the cat «Desmos» side panel sends to Суу (features/tutor/lib/desmos-panel.ts). */
  desmos?: DesmosPanelInput;
};
export type DesmosPanelInput = {
  /** What Суу reads: the prompt without $…$ delimiters, plus the choices as "A) …" lines. */
  question: string;
  /**
   * The correct answer the lesson must reach: a choice's value when it is a plain number, fraction or point
   * (Desmos lessons check those), otherwise its letter; for grid-in, the first accepted answer.
   */
  answer?: string;
  /** Hand-written Desmos rows (Question.desmos.rows), drawn when Суу has no lesson. */
  rows?: string[];
  /** Hand-written tip. It often names the answer, so the panel shows it only once the answer is in. */
  tip?: string;
};
export type ChatMessage = {
  role: 'user' | 'suu';
  text: string;
  graph?: string[];
  mode?: TutorMode;
  at: number;
  demo?: boolean;
};
