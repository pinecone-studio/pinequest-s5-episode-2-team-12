# AQuA-RAT → harder Desmos lessons for Suu

Suu was trained on lessons made from templates, so it does well on easy questions and fails on
real, wordy SAT problems. This kit makes **harder training lessons** from
[AQuA-RAT](https://github.com/google-deepmind/AQuA) (Google DeepMind, **Apache 2.0**, ~98k
GMAT/GRE-style word problems with the correct answer and a written solution).

Nothing from College Board is used.

## How it works

```
AQuA-RAT (98k) ──prepare.py──▶ clean pool (~31k) ──generate.py (Gemini)──▶ lessons ──verify.py──▶ build.py ──▶ ai/data/aqua/*.jsonl
                 filter + fix noisy keys            question + answer + hint     app rules + math check     same format as the Desmos kit
```

1. **prepare.py** keeps a question only if every choice is a single number, the answer key agrees with
   AQuA's own solution (AQuA is noisy), the topic fits SAT + Desmos (no counting, probability, digit
   puzzles), and it isn't a duplicate. Test questions come only from AQuA dev/test.
2. **generate.py** asks Gemini for a Mongolian Desmos lesson in Suu's JSON format, with 4 gold lessons
   (`examples.json`) as examples. A failing lesson gets one fix request with the reason.
3. **verify.py** checks each lesson:
   - the app's own rules (same as `parseModelLesson`: JSON, steps, safe Desmos items, ≥ 60 % Mongolian, answer),
   - a **math check**: the Desmos items run in a small Desmos-like engine (sympy), and the correct answer must
     *come out of the graph* (intersection, zero, max/min, solved equation, computed value). Typing the answer
     as a number or a point does not count, and a typo in an equation fails.
4. **build.py** writes `train / val / test` rows in the exact chat format the app sends
   (`Асуулт: …\nЗөв хариу: …`) plus `report.md`.

## Run it

```bash
pip install sympy
git clone --depth 1 https://github.com/google-deepmind/AQuA ai/data/raw/AQuA
python3 ai/aqua/prepare.py                       # → ai/data/raw/aqua_pool.jsonl (~31k questions)

export GEMINI_API_KEY=...                        # same key as the app's .env
python3 ai/aqua/generate.py --train 20 --test 5  # quick try: look at the pass rate first
python3 ai/aqua/generate.py --train 3000 --test 150 --rpm 60   # full run, can stop and continue

python3 ai/aqua/build.py                         # → ai/data/aqua/{train,val,test}.jsonl + report.md
bun ai/aqua/app-check.ts ai/data/aqua/train.jsonl   # the app's checker must pass 100 %
```

Free-tier Gemini has per-minute and per-day limits: lower `--rpm` if you see many 429 waits, and run it
over a few days if needed (it continues where it stopped). Raw files stay in `ai/data/raw/` (git-ignored);
commit only `ai/data/aqua/`.

Then train: `ai/train/suu_v2.ipynb` picks up `ai/data/aqua/` from the repo automatically
(`CAP["aqua"]` rows in training, `EVAL_N["aqua"]` test questions scored before/after). Without the files it
trains exactly as before.

## Tests (no Gemini key needed)

```bash
python3 ai/aqua/test_aqua.py   # filter, checker (gold passes; fake, typo, English fail), generate→build with a fake Gemini
```

## Honest limits

- This makes Suu better at **teaching** harder word problems **when it is given the answer**. It does not
  make a 3B model a strong solver — solving still belongs to Gemini or the answer key.
- The Mongolian text is written by Gemini. A native speaker should read ~30 random lessons before training.
- The math check proves the Desmos steps reach the answer, not that every sentence is the best explanation.
- AQuA uses GMAT/GRE wording (some rupees, trains, pipes). It is close to SAT word problems, not identical.
