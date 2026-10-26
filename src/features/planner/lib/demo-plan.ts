// Pitch demo · AI төлөвлөгөө. Builds a study plan from the exam date and the phase split in PHASES.
// The week schedule text is hand-written (labelled «Жишээ төлөвлөгөө») until the AI planner (I4) is built.
import { DAY_MS } from '@/lib/time';

export type Phase = { n: string; what: string; f: number };
export type PlanInput = {
  examDate: string;
  today: string;
  current: number;
  target: number;
  hoursPerDay: number;
};
export type PlannedPhase = Phase & { weeks: number; from: string; to: string };
export type DemoPlan = {
  weeks: number;
  totalHours: number;
  gain: number;
  phases: PlannedPhase[];
};

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Weeks until the exam (at least 1) split across the phases by their share `f`, oldest first. */
export function buildPlan(input: PlanInput, phases: Phase[]): DemoPlan {
  const start = Date.parse(`${input.today}T00:00:00Z`);
  const end = Date.parse(`${input.examDate}T00:00:00Z`);
  const days = Math.max(7, Math.round((end - start) / DAY_MS));
  const weeks = Math.max(1, Math.round(days / 7));

  // floor of each share (at least 1 week when there is room), then hand out / take back the
  // remaining weeks by largest remainder, so the biggest phase (weak topics) gets the extra weeks
  const exact = phases.map((p) => p.f * weeks);
  const minWeeks = weeks >= phases.length ? 1 : 0;
  const raw = exact.map((x) => Math.max(minWeeks, Math.floor(x)));
  const total = () => raw.reduce((a, b) => a + b, 0);
  while (total() < weeks) {
    const i = exact.reduce((best, x, j) => (x - raw[j] > exact[best] - raw[best] ? j : best), 0);
    raw[i]++;
  }
  while (total() > weeks) {
    const options = raw.map((_, j) => j).filter((j) => raw[j] > minWeeks);
    const i = options.reduce(
      (best, j) => (exact[j] - raw[j] < exact[best] - raw[best] ? j : best),
      options[0],
    );
    raw[i]--;
  }

  let cursor = start;
  const planned: PlannedPhase[] = [];
  phases.forEach((p, i) => {
    if (!raw[i]) return;
    const from = cursor;
    cursor += raw[i] * 7 * DAY_MS;
    const last = raw.slice(i + 1).every((w) => !w);
    planned.push({
      ...p,
      weeks: raw[i],
      from: iso(from),
      to: iso((last ? end : Math.min(cursor, end)) - DAY_MS),
    });
  });

  return {
    weeks,
    totalHours: Math.round(days * input.hoursPerDay),
    gain: Math.max(0, input.target - input.current),
    phases: planned,
  };
}

/** This week's schedule (hand-written sample). `{weak}` is replaced with the student's weak topic. */
export const WEEK = [
  { day: 'Да', task: '{weak}: замналын 2 хичээл + 15 асуулт', min: 90 },
  { day: 'Мя', task: 'Desmos Академи: огтлолцол ба slider', min: 60 },
  { day: 'Лх', task: '{weak}: хүнд асуултын бүс, 10 асуулт', min: 90 },
  { day: 'Пү', task: 'Карт: 30 томьёо ба англи үг давтах', min: 30 },
  { day: 'Ба', task: 'Холимог 22 асуулт, 35 минут цаг хэмжинэ', min: 60 },
  { day: 'Бя', task: 'Mock тест (Math хэсэг) + алдааны дэвтэр', min: 120 },
  { day: 'Ня', task: 'Амрах. Зөвхөн алдааны дэвтрээ 15 минут харах', min: 15 },
];

export const WEAK_TOPICS = ['Алгебр', 'Квадрат функц', 'Өгөгдөл ба статистик', 'Геометр', 'Хувь ба харьцаа'];
