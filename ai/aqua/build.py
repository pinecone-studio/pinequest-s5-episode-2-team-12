"""Checked AQuA lessons -> training rows in the same format as the first Desmos kit.

Reads the raw Gemini replies, re-checks every one with verify.py (so a hand edit or a
changed rule is always applied), and writes:

  ai/data/aqua/train.jsonl   (AQuA train questions, 95 %)
  ai/data/aqua/val.jsonl     (AQuA train questions, 5 %)
  ai/data/aqua/test.jsonl    (AQuA dev/test questions only — never trained on)
  ai/data/aqua/report.md     (counts, pass rates, topics)

Each row: {"skill": "desmos", "source": "aqua", "id", "topic", "answer",
           "messages": [system DESMOS_PROMPT, user "Асуулт: …\\nЗөв хариу: …", assistant lesson JSON]}
The user message is exactly what the app sends (src/server/ai/prompts.ts → desmosUserMessage).

Usage: python3 ai/aqua/build.py
"""

from __future__ import annotations

import argparse
import collections
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import verify  # noqa: E402

# same text as src/server/ai/prompts.ts and ai/v2/skills.ts (DESMOS_PROMPT)
DESMOS_PROMPT = (
    "Чи SAT Math-ийн багш. Desmos-оор заах нь чиний гол арга. Асуулт болон зөв хариуг өгөхөд хамгийн тохирох "
    "Desmos аргыг сонгож, алхам бүрт Desmos-д юу хийхийг энгийн монголоор тайлбарла. Зөвхөн JSON буцаа: "
    '{"technique":...,"steps":[{"text":...,"desmos":[...],"bounds":{...}}],"check":...,"answer":...}'
)


def to_row(item: dict, lesson: dict) -> dict:
    return {
        "skill": "desmos",
        "source": "aqua",
        "id": item["id"],
        "topic": item["topic"],
        "answer": item["answer"],
        "messages": [
            {"role": "system", "content": DESMOS_PROMPT},
            {"role": "user", "content": f"Асуулт: {item['question'].strip()}\nЗөв хариу: {item['answer'].strip()}"},
            {"role": "assistant", "content": json.dumps(lesson, ensure_ascii=False)},
        ],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="ai/data/raw/aqua_lessons_raw.jsonl")
    ap.add_argument("--out", default="ai/data/aqua")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    reasons: collections.Counter = collections.Counter()
    topics: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    tries: collections.Counter = collections.Counter()
    rows = {"train": [], "test": []}
    seen = set()
    for line in open(args.raw, encoding="utf-8"):
        item = json.loads(line)
        if item["id"] in seen:
            continue
        seen.add(item["id"])
        lesson, why, _ = verify.check(item.get("reply", ""), item["answer"])
        reasons[why] += 1
        if not lesson:
            continue
        tries[item.get("tries", 1)] += 1
        rows[item["split"]].append(to_row(item, lesson))
        topics[item["split"]][item["topic"]] += 1

    random.Random(7).shuffle(rows["train"])
    n_val = len(rows["train"]) // 20  # 5 % (none when there are under 20 rows)
    splits = {"train": rows["train"][n_val:], "val": rows["train"][:n_val], "test": rows["test"]}
    for name, rs in splits.items():
        with open(out / f"{name}.jsonl", "w", encoding="utf-8") as fh:
            for r in rs:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")

    total = sum(reasons.values())
    ok = reasons["ok"]
    lines = [
        "# AQuA-RAT → Desmos lessons",
        "",
        f"- Gemini replies checked: **{total}**, passed every check: **{ok}** ({ok / max(total, 1):.0%})",
        f"- Passed on the first try: {tries[1]}, after one fix: {tries[2]}",
        f"- Why the others failed: {dict((k, v) for k, v in reasons.most_common() if k != 'ok')}",
        f"- train **{len(splits['train'])}** · val **{len(splits['val'])}** · test **{len(splits['test'])}** "
        "(test = AQuA dev/test questions only)",
        "",
        "| topic | train | test |",
        "|---|---|---|",
    ]
    for t in sorted(set(topics["train"]) | set(topics["test"])):
        lines.append(f"| {t} | {topics['train'][t]} | {topics['test'][t]} |")
    lines += [
        "",
        "Checks: the app's lesson rules (JSON, steps, safe Desmos items, ≥ 60 % Mongolian, answer) and a math",
        "check — the answer must come out of the Desmos items (intersection, zero, max/min, solved equation or",
        "computed value). The Mongolian wording is written by Gemini: a native speaker should read a sample.",
    ]
    (out / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
