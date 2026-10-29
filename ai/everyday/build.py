"""Checked everyday chats -> chat-skill training rows (same format as ai/data/tuning-v2).

Re-checks every chat with verify.py, drops duplicate questions, keeps the mix balanced
(no category over --cap-share), and writes:

  ai/data/everyday/train.jsonl  val.jsonl  test.jsonl   (90 / 5 / 5 %, split by subtopic+style group)
  ai/data/everyday/review.csv   (60 random chats for a native speaker to read before training)
  ai/data/everyday/report.md

Row: {"skill": "chat", "source": "everyday", "id", "category", "style",
      "messages": [system chat prompt, user, assistant, (user, assistant)]}

Usage: python3 ai/everyday/build.py
"""

from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import verify  # noqa: E402

PROMPTS = Path("ai/data/tuning-v2/prompts.json")


def chat_prompt() -> str:
    return json.loads(PROMPTS.read_text(encoding="utf-8"))["chat"]


def split_of(item: dict) -> str:
    """Whole (subtopic, style, round) groups go to one split, so test chats are not near-copies of train."""
    h = int(hashlib.sha1(item["job"].encode()).hexdigest(), 16) % 100
    return "test" if h < 5 else "val" if h < 10 else "train"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="ai/data/raw/everyday_raw.jsonl")
    ap.add_argument("--out", default="ai/data/everyday")
    ap.add_argument("--cap-share", type=float, default=0.18, help="max share of one category")
    args = ap.parse_args()

    system = chat_prompt()
    reasons: collections.Counter = collections.Counter()
    seen: set[str] = set()
    good: list[dict] = []
    for line in open(args.raw, encoding="utf-8"):
        item = json.loads(line)
        if not item.get("id"):
            reasons["empty_call"] += 1
            continue
        why = verify.check_item(item)
        if why == "ok":
            key = verify.norm_question(item["turns"][0]["user"])
            if key in seen:
                why = "duplicate"
            seen.add(key)
        reasons[why] += 1
        if why == "ok":
            good.append(item)

    random.Random(3).shuffle(good)
    cap = max(20, int(len(good) * args.cap_share))
    per_cat: collections.Counter = collections.Counter()
    kept = []
    for it in good:
        if per_cat[it["category"]] < cap:
            per_cat[it["category"]] += 1
            kept.append(it)
        else:
            reasons["over_cap"] += 1

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    splits: dict[str, list] = {"train": [], "val": [], "test": []}
    for it in kept:
        msgs = [{"role": "system", "content": system}]
        for t in it["turns"]:
            msgs += [{"role": "user", "content": t["user"].strip()}, {"role": "assistant", "content": t["suu"].strip()}]
        splits[split_of(it)].append({"skill": "chat", "source": "everyday", "id": it["id"],
                                     "category": it["category"], "style": it["style"], "messages": msgs})
    for name, rows in splits.items():
        with open(out / f"{name}.jsonl", "w", encoding="utf-8") as fh:
            for r in rows:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")

    with open(out / "review.csv", "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["id", "category", "style", "student", "suu", "ok? (yes/no)", "note"])
        for it in random.Random(9).sample(kept, min(60, len(kept))):
            w.writerow([it["id"], it["category"], it["style"],
                        " ⏎ ".join(t["user"] for t in it["turns"]), " ⏎ ".join(t["suu"] for t in it["turns"]), "", ""])

    total = sum(v for k, v in reasons.items() if k != "empty_call")
    styles = collections.Counter(it["style"] for it in kept)
    lines = [
        "# Everyday chats for Suu",
        "",
        f"- chats checked: **{total}**, kept: **{len(kept)}** "
        f"(train {len(splits['train'])} · val {len(splits['val'])} · test {len(splits['test'])})",
        f"- dropped: {dict((k, v) for k, v in reasons.most_common() if k != 'ok')}",
        f"- styles: {dict(styles.most_common())}",
        "",
        "| category | kept |",
        "|---|---|",
        *[f"| {c} | {n} |" for c, n in per_cat.most_common()],
        "",
        "Before training: a native speaker reads `review.csv` (60 random chats). If more than ~5 are bad,",
        "fix the prompt in generate.py and run again instead of training on it.",
    ]
    (out / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
