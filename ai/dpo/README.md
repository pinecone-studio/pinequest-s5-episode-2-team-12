# DPO preference pairs

SFT teaches Suu what a good reply looks like. DPO also shows it a bad reply to the same prompt, so the model learns
to push away from the mistakes it really makes. Each pair kind targets a weakness measured in `ai/models/EVAL.md`:

| Kind | Chosen | Rejected | Fixes |
| --- | --- | --- | --- |
| `verdict-wrong` | the honest "not quite" reply | false praise ("Зөв байна! 🎉") | the student's wrong answer called correct (90% in v2) |
| `verdict-right` | the praise | false blame | the student's right answer called wrong |
| `hint-leak` | the hint | the same hint plus `Хариу: …` | the final answer given away in a hint (10–30%) |
| `distill` | a verified teacher reply | a teacher reply that failed the checks | wrong answers, English, broken JSON |
| `lesson-answer` | a verified Desmos lesson | the same lesson ending with a near-miss answer | lessons that drift away from the given answer |

```
bun ai/dpo/pairs.ts                    # → ai/out/dpo/{train,val}.jsonl (uses ai/out/distill if it exists)
python ai/train/dpo.py --adapter suu_v2/lora --pairs ai/out/dpo --out suu_dpo   # Colab T4
python ai/train/dpo_test.py            # CPU check of the training helpers
```

Without distillation output you still get about 1,200 pairs from the committed v2 chat data
(verdict and hint-leak pairs).

`dpo.py` continues from the SFT adapter. The reference model is a frozen copy of that adapter, not the bare base
model. It prints **preference accuracy** on val before and after training: how often the model gives the chosen
reply a higher probability than the rejected one. Report that number together with the live checks
(`bun ai/eval/desmos-live.ts`).
