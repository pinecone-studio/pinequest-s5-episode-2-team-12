// Runs the app's own lesson checker (parseModelLesson) over built AQuA rows, so the training data
// is exactly what the Desmos page accepts. Usage: bun ai/aqua/app-check.ts ai/data/aqua/train.jsonl
import { readFileSync } from 'node:fs';
import { parseModelLesson } from '@/features/tutor/lib/desmos-lesson-parse';

const path = process.argv[2] ?? 'ai/data/aqua/train.jsonl';
const rows = readFileSync(path, 'utf8')
  .split('\n')
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l) as { id: string; answer: string; messages: { content: string }[] });

const fails: Record<string, number> = {};
for (const r of rows) {
  const question = r.messages[1].content.replace(/^Асуулт: /, '').split('\nЗөв хариу:')[0];
  const res = parseModelLesson(r.messages[2].content, question, r.answer);
  if (!res.ok) fails[res.reason] = (fails[res.reason] ?? 0) + 1;
}
const bad = Object.values(fails).reduce((a, b) => a + b, 0);
console.log(`${rows.length - bad}/${rows.length} rows pass the app checker`, bad ? fails : '');
if (bad) process.exit(1);
