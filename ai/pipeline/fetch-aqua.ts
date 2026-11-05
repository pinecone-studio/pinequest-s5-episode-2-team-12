// Downloads AQuA-RAT (Apache-2.0) into ai/data/raw/aqua/ (git-ignored). Then: bun ai/pipeline/harder.ts --aqua …
//   bun ai/pipeline/fetch-aqua.ts            # train (~97k rows) + test
//   bun ai/pipeline/fetch-aqua.ts test       # just the 254 test rows
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = 'https://raw.githubusercontent.com/google-deepmind/AQuA/master';
const splits = process.argv.slice(2).length ? process.argv.slice(2) : ['train', 'test'];
mkdirSync('ai/data/raw/aqua', { recursive: true });
for (const s of splits) {
  const res = await fetch(`${BASE}/${s}.json`);
  if (!res.ok) throw new Error(`${s}: HTTP ${res.status}`);
  const text = await res.text();
  writeFileSync(`ai/data/raw/aqua/${s}.json`, text);
  console.log(`${s}: ${text.split('\n').filter((l) => l.trim()).length} rows → ai/data/raw/aqua/${s}.json`);
}
