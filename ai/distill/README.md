# Verified distillation (rejection sampling)

A big teacher model writes Desmos lessons and step-by-step explanations for our generated questions.
The code checks every reply, and only replies with the right final answer become training data for Suu.
The teacher is never trusted. The gold answer always comes from the template code.

```
bun ai/distill/prompts.ts --seed 41 --per 6        # 1. questions → teacher prompts (hard ones first)
GEMINI_API_KEY=… bun ai/distill/teacher.ts --k 3   # 2. 3 replies per prompt (resumable)
bun ai/distill/verify.ts                           # 3. keep only verified replies
```

Output is in `ai/out/distill/` (git-ignored):

| File | What |
| --- | --- |
| `prompts.jsonl` | prompts in the exact format Suu is trained and served with, plus the gold answer |
| `candidates.jsonl` | raw teacher replies `{ id, sample, text }` |
| `sft.jsonl` | training rows `{ skill, id, messages }`: the shortest passing reply per prompt |
| `rejected.jsonl` | failed replies with a reason, used for DPO pairs (`ai/dpo`) |
| `report.md` | pass rates per skill, per template and per difficulty |

Checks (`verify.ts`):

- **desmos**: the same `parseModelLesson` the website uses. It checks valid JSON, Desmos items, at least 60% Mongolian text, and that the final answer equals the gold answer.
- **chat**: the reply ends with `Хариу: …` equal to the gold answer (for multiple choice, the letter or the choice's value), is at least 60% Mongolian, and is shorter than 2,500 characters.

To train on it, upload `sft.jsonl` next to the kit zips in `ai/train/suu_v2.ipynb`. Its rows use the same
`{ skill, messages }` format as `ai/data/tuning-v2/train.jsonl`.
