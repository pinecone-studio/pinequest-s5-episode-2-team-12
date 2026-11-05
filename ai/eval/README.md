# Model evaluation and release gate

Every model gets one **scorecard** from the same fixed, held-out questions, measured the way the website calls it.

```
bun ai/eval/run.ts --model suu-v2 --live            # on the computer running Ollama (ai/serve/start.sh)
bun ai/eval/run.ts --model suu-v2 --pred out.jsonl  # or score saved outputs {"id", "output"}
```

| Part | Questions | Metric |
| --- | --- | --- |
| `hard` | `hard-holdout.json`: 36 questions, 3 per hard template, seeds no training data uses | `hard.answer_correct`: the explanation ends with the right answer |
| `desmos` | `desmos-holdout.json`: 48 kit problems | `desmos.shown`: the app would show the lesson (`parseModelLesson`) |
| `v2` | `ai/data/tuning-v2/test.jsonl` | chat / planner / analyze / stepcheck, scored by `ai/v2/score.ts` |

The scorecard is written to `ai/models/<model>/scorecard.json`. Commit it with the model.

**Gate (CI):** `bun run ai:gate` is part of `bun run check`. It compares the last two models in `ai/models/ORDER`
that have a scorecard. If any metric drops more than 3 points, CI fails. For `hint_leak` and `false_praise`, lower
is better, so a rise fails. Add a new model to `ORDER` when you release it.

If the hard templates change, run `bun run ai:hard-set`. A test checks that the committed set matches the generator.
