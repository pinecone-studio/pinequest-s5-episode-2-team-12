"""AQuA-RAT -> a clean pool of SAT-style word problems for Desmos lessons.

AQuA-RAT (Google DeepMind, Apache 2.0): ~98k GMAT/GRE-style algebra word problems,
5 choices, a written rationale and the correct letter. The data is noisy, so we keep
only questions that pass every check below:

  * every choice is a single number (units, %, $ and "Rs." are stripped),
  * the correct choice is one of them and the 5 values are different,
  * the rationale's last lines mention the correct value (answer key agrees),
  * the topic fits the SAT and Desmos (no counting / probability / digit puzzles),
  * plain length, no I/II/III statements, no duplicates.

Usage:
  git clone --depth 1 https://github.com/google-deepmind/AQuA ai/data/raw/AQuA
  python3 ai/aqua/prepare.py --src ai/data/raw/AQuA --out ai/data/raw/aqua_pool.jsonl

Train items come from AQuA train; our test items come only from AQuA dev+test,
so the test set never shares questions with training.
"""

from __future__ import annotations

import argparse
import collections
import json
import re
from pathlib import Path

NUM = r"-?\d+(?:,\d{3})*(?:\.\d+)?(?:\s*/\s*\d+(?:\.\d+)?)?"

# words that mean the question is not a good SAT + Desmos question
SKIP_WORDS = re.compile(
    r"\b(probabilit\w*|ways|arrange\w*|permutation\w*|combination\w*|committee\w*|dice|die|cards?|coins? (?:is|are) tossed|"
    r"digit\w*|remainder|divisible|prime|factorial|unit'?s? place|tens place|odd|even|integers? n|how many (?:different|distinct)|"
    r"letters?|word \w+ be|seated|handshakes?|tournament|"
    r"clock|calendar|day of the week|leap year|"
    r"I\.|II\.|III\.|which of the following (?:must|could|can|cannot|is not))\b",
    re.IGNORECASE,
)

# rough topic tags, used to balance the training mix
TOPICS = [
    ("percent", r"percent|%|discount|profit|loss|markup|tax|commission"),
    ("interest", r"interest|compound|principal|invest"),
    ("rate", r"speed|km/h|kmph|mph|km/hr|travel|train|walk|drive|distance|upstream|downstream|stream"),
    ("work", r"work|job|pipe|tank|fill|together|alone"),
    ("ratio", r"ratio|proportion|mixture|alloy|share|partner"),
    ("average", r"average|mean|median|sum of \w+ numbers"),
    ("age", r"\bage|years old|older|younger"),
    ("geometry", r"area|perimeter|rectangle|square|circle|triangle|radius|volume|cube|cylinder"),
    ("line", r"slope|line|coordinate|intercept"),
    ("quadratic", r"x\^2|square of|squared|quadratic"),
]


def parse_number(text: str) -> float | None:
    """A choice like 'A)21.5', '$1,200', 'Rs. 500', '20%', '1/5' -> its single number, else None."""
    t = text.strip()
    t = re.sub(r"^\(?[A-Ea-e]\)\s*", "", t)  # 'A)' prefix
    t = re.sub(r"(?i)\b(rs\.?|inr|usd|dollars?|cents?|km|kms|m|cm|hrs?|hours?|minutes?|mins?|days?|years?|"
               r"kg|g|l|litres?|liters?|units?|sq\.?|per|annum|p\.a\.|%|\$)", " ", t)
    t = t.replace("$", " ").replace("%", " ").strip(" .")
    nums = re.findall(NUM, t)
    if len(nums) != 1:
        return None
    rest = t.replace(nums[0], "", 1).strip(" .,:;")
    if rest:  # words or symbols left over (e.g. 'x+2', '4 and 1', 'sqrt')
        return None
    n = nums[0].replace(",", "").replace(" ", "")
    if "/" in n:
        a, b = n.split("/")
        if float(b) == 0:
            return None
        return float(a) / float(b)
    return float(n)


def fmt(v: float) -> str:
    """Number as the 'Зөв хариу' string: 23, 21.5, 0.333333 (6 digits max)."""
    if abs(v - round(v)) < 1e-9:
        return str(int(round(v)))
    return f"{v:.6f}".rstrip("0").rstrip(".")


def numbers_in(text: str) -> list[float]:
    out = []
    for n in re.findall(NUM, text.replace(",", "")):
        n = n.replace(" ", "")
        try:
            if "/" in n:
                a, b = n.split("/")
                out.append(float(a) / float(b))
            else:
                out.append(float(n))
        except (ValueError, ZeroDivisionError):
            pass
    return out


def close(a: float, b: float) -> bool:
    return abs(a - b) <= 1e-6 + 1e-4 * max(abs(a), abs(b))


def topic_of(q: str) -> str:
    for name, pat in TOPICS:
        if re.search(pat, q, re.IGNORECASE):
            return name
    return "algebra"


def check_row(row: dict) -> tuple[dict | None, str]:
    q = " ".join(row["question"].split())
    if not 40 <= len(q) <= 600:
        return None, "length"
    if not q.isascii():
        return None, "non_ascii"
    if SKIP_WORDS.search(q):
        return None, "topic"
    # a real question: asks something and isn't cut off ("... Options:")
    if q.rstrip().lower().endswith(("options:", "options", ":")) or not (
        "?" in q or re.search(r"\b(find|what|how|calculate|determine|then)\b", q, re.IGNORECASE)
    ):
        return None, "not_a_question"
    opts = row.get("options") or []
    if len(opts) != 5:
        return None, "options"
    letters = [o.strip()[:1].upper() for o in opts]
    values = [parse_number(o) for o in opts]
    if any(v is None for v in values):
        return None, "not_numeric"
    if len({round(v, 6) for v in values}) != 5:
        return None, "same_values"
    letter = (row.get("correct") or "").strip().upper()
    if letter not in letters:
        return None, "bad_key"
    value = values[letters.index(letter)]
    # the answer key must agree with the rationale: the correct value appears near its end
    tail = "\n".join(row.get("rationale", "").strip().splitlines()[-4:])
    if not any(close(value, n) for n in numbers_in(tail)):
        return None, "key_not_in_rationale"
    return {
        "question": q,
        "choices": [f"{l}) {fmt(v)}" for l, v in zip(letters, values)],
        "letter": letter,
        "answer": fmt(value),
        "rationale": row.get("rationale", "").strip(),
        "topic": topic_of(q),
    }, "ok"


def norm_key(q: str) -> str:
    return re.sub(r"[^a-z0-9]", "", q.lower())


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="ai/data/raw/AQuA", help="folder with train.json, dev.json, test.json")
    ap.add_argument("--out", default="ai/data/raw/aqua_pool.jsonl")
    args = ap.parse_args()

    seen: set[str] = set()
    reasons: collections.Counter = collections.Counter()
    topics: dict[str, collections.Counter] = {"train": collections.Counter(), "test": collections.Counter()}
    rows_out = []
    # test pool first, so a question that is in both splits stays out of training
    for split, files in (("test", ["dev.json", "test.json"]), ("train", ["train.json"])):
        for name in files:
            with open(Path(args.src) / name, encoding="utf-8") as fh:
                for i, line in enumerate(fh):
                    if not line.strip():
                        continue
                    item, why = check_row(json.loads(line))
                    reasons[why] += 1
                    if not item:
                        continue
                    key = norm_key(item["question"])
                    if key in seen:
                        reasons["duplicate"] += 1
                        continue
                    seen.add(key)
                    item["id"] = f"aqua-{name.split('.')[0]}-{i}"
                    item["split"] = split
                    topics[split][item["topic"]] += 1
                    rows_out.append(item)

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as fh:
        for r in rows_out:
            fh.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"kept {len(rows_out)} → {args.out}")
    print("why rows were dropped:", dict(reasons.most_common()))
    for split, c in topics.items():
        print(split, sum(c.values()), dict(c.most_common()))


if __name__ == "__main__":
    main()
