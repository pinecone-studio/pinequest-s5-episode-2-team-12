// H6 · Release gate, run in CI (`bun run ai:gate`). Compares the newest model's scorecard with the previous one:
// a model that is worse on any metric by more than TOLERANCE points does not pass. Lower-is-better metrics
// (hint_leak, false_praise) are flipped. With fewer than two scorecards there is nothing to compare: it passes.
//
// The order of models is ai/models/ORDER (one folder name per line, oldest first).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Scorecard } from './run';

/** Points a metric may drop before the gate fails (one or two questions of noise on a small set). */
export const TOLERANCE = 3;
const LOWER_IS_BETTER = /hint_leak|false_praise/;

export type Drop = { metric: string; before: number; after: number };

export function compare(before: Scorecard, after: Scorecard, tolerance = TOLERANCE): Drop[] {
  const drops: Drop[] = [];
  for (const [metric, b] of Object.entries(before.metrics)) {
    const a = after.metrics[metric];
    if (a === undefined) {
      drops.push({ metric, before: b, after: Number.NaN });
      continue;
    }
    const worse = LOWER_IS_BETTER.test(metric) ? a - b : b - a;
    if (worse > tolerance) drops.push({ metric, before: b, after: a });
  }
  return drops;
}

const MODELS = join(import.meta.dir, '..', 'models');

export function scorecards(order: string[]): Scorecard[] {
  return order
    .map((m) => join(MODELS, m, 'scorecard.json'))
    .filter((p) => existsSync(p))
    .map((p) => JSON.parse(readFileSync(p, 'utf8')) as Scorecard);
}

export function readOrder(): string[] {
  const p = join(MODELS, 'ORDER');
  if (!existsSync(p)) return [];
  return readFileSync(p, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

if (import.meta.main) {
  const cards = scorecards(readOrder());
  if (cards.length < 2) {
    console.log(`ai:gate — ${cards.length} scorecard, харьцуулах зүйлгүй. OK`);
    process.exit(0);
  }
  const [before, after] = cards.slice(-2) as [Scorecard, Scorecard];
  const drops = compare(before, after);
  if (drops.length) {
    console.error(`ai:gate — ${after.model} нь ${before.model}-оос муу:`);
    for (const d of drops)
      console.error(`  ${d.metric}: ${d.before} → ${Number.isNaN(d.after) ? 'алга' : d.after}`);
    process.exit(1);
  }
  console.log(`ai:gate — ${after.model} ≥ ${before.model} (зөвшөөрөх уналт ${TOLERANCE} оноо). OK`);
}
