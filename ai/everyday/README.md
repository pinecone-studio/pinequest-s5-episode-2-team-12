# Everyday chats for Suu (student life)

Suu's chat data is mostly math (hints, explanations, step checks) plus ~27 hand-written general answers
(`ai/v2/chat-extra.ts`). This kit makes a **large, checked set of everyday student questions**, so Suu
answers them well on its own (offline, or when Gemini is down):

| Category | Examples |
|---|---|
| study_habits | daily routine, phone distraction, procrastination, remembering formulas |
| motivation | lost motivation, comparing to others, low mock score, parents' pressure, burnout |
| wellbeing | test anxiety, sleep, test-day food, feeling overwhelmed |
| sat_basics / sat_strategy | modules, scoring, retakes, Bluebook/Desmos, timing, guessing, last week |
| english_for_math | at least / at most / respectively, long English word problems |
| university | why SAT, test-optional, scholarships (no promises), choosing a major |
| app_help | every real section of the app (names come from `src/messages/mn.json`) |
| about_suu, small_talk | who Suu is, mistakes, privacy, greetings, rude students |
| off_topic | politics, other subjects, games → one kind sentence, back to studying |
| integrity | leaked questions, cheating, doing a test for someone → clear no + honest alternative |
| safety | strangers in duels, bullying, personal data |
| crisis | hopelessness, self-harm hints, abuse → warm, short, trusted adult, **108**, 103 |

Each subtopic is written in 5 styles: Cyrillic, **Latin-script Mongolian** ("yaj ehleh ve"), short slang
with typos, English, and two-turn chats. Suu always answers in Cyrillic Mongolian.

## How it works

```
topics.py (14 categories, 80 subtopics × 5 styles) ──generate.py (Gemini, 8 chats/call)──▶ verify.py ──▶ build.py ──▶ ai/data/everyday/*.jsonl
```

**verify.py** rejects an answer when it: is not ≥ 70 % Mongolian · is too short/long or emoji-heavy ·
has a link (except collegeboard.org) or a phone number · names an app section that doesn't exist ·
claims to be human / ChatGPT / Gemini · promises a score · (crisis) lacks 108 or a trusted person ·
(integrity) doesn't say no. **build.py** drops duplicate questions, caps any category at 18 %, splits by
whole subtopic groups (test chats are not near-copies of training chats), and writes `review.csv`.

## Run it

```bash
export GEMINI_API_KEY=...                       # same key as the app's .env
python3 ai/everyday/generate.py --limit 10      # quick try (10 calls, ~80 chats): check the pass rate
python3 ai/everyday/generate.py                 # full run: ~400 calls → ~3,200 chats before checks
python3 ai/everyday/generate.py --rounds 2      # optional: a second, different set
python3 ai/everyday/build.py                    # → ai/data/everyday/{train,val,test}.jsonl, review.csv, report.md
```

Then **a native speaker reads `review.csv`** (60 random chats, mark yes/no). If more than ~5 are bad, fix the
prompt in `generate.py` and regenerate. Commit only `ai/data/everyday/` (raw files stay in git-ignored
`ai/data/raw/`).

Training: `ai/train/suu_v2.ipynb` picks up `ai/data/everyday/` automatically (`CAP["everyday"]` rows, and
`EVAL_N["everyday"]` test chats scored before/after with the same rules). Without the files nothing changes.

## Tests (no key needed)

```bash
python3 ai/everyday/test_everyday.py   # rules, section names = real app nav, fake Gemini → build
```

## Honest limits

- **Check the crisis numbers with a teammate**: 108 (child & family helpline) and 103 (ambulance) are in
  `topics.py`. Wrong numbers in a crisis answer would be the worst bug in this kit.
- The rules catch format, language and safety mistakes, not bad advice. That is what `review.csv` is for.
- A 3B model trained on this will still sometimes be wrong. Keep facts (dates, fees, requirements) out of
  its answers — the data teaches it to send students to collegeboard.org instead.
- ~1,200 of these go into training by default, so Suu's math skills keep most of the mix.
