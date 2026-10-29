"""Gemini writes Mongolian Desmos lessons for AQuA-RAT questions; every lesson is checked.

For each question Gemini gets the question, the correct answer and AQuA's own rationale
(as a hint only), plus 4 gold lessons (ai/aqua/examples.json) as examples. The reply is
checked right away with verify.py (app rules + mini Desmos engine). If it fails, Gemini
gets one more try with the reason. Only the raw replies are saved here; build.py keeps the
passing ones.

The run can stop and start again: questions already in --out are skipped.

Usage (needs a Gemini API key from https://aistudio.google.com):
  export GEMINI_API_KEY=...
  python3 ai/aqua/generate.py --train 3000 --test 150            # full run
  python3 ai/aqua/generate.py --train 20 --test 5                 # quick try first
Options: --model gemini-2.5-flash  --workers 4  --rpm 60
"""

from __future__ import annotations

import argparse
import collections
import json
import os
import random
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import verify  # noqa: E402

API = "https://generativelanguage.googleapis.com/v1beta/models"

INSTRUCTIONS = """You write SAT Math lessons that teach a Mongolian high-school student to solve a word problem WITH THE DESMOS GRAPHING CALCULATOR, step by step.

You get: the question (English), the correct answer, and a reference solution (it may contain mistakes; never copy its wording).

Return ONLY one JSON object:
{"technique": "<one of: intersection_equation, system_intersection, quadratic_zeros, max_min, slider_constant, linear_regression, statistics, inequality_system, circle, function_eval, function_input, equivalent_expressions, distance_midpoint, percent, number_theory>",
 "steps": [{"text": "...", "desmos": [{"latex": "...", "color": "blue"}], "bounds": {"left": -5, "right": 40, "bottom": -10, "top": 60}}],
 "check": "...",
 "answer": "<the correct answer, the same number you were given>"}

Rules:
1. "text" is SIMPLE MONGOLIAN (Cyrillic), short sentences, max 350 characters. Put an English math term in brackets the first time you use it, e.g. огтлолцлын цэг (intersection point), тэгшитгэл (equation). Names and numbers from the question stay as they are.
2. First step: turn the words into math. Say what x means, then write the equation as a Desmos curve.
3. The answer must COME OUT OF DESMOS: an intersection of two curves (y = left side, y = right side), a zero, a max/min, or a value Desmos computes (like s=3\\cdot305 or \\frac{s+400}{4}). Never just type the answer as a number.
4. If the question asks for something other than x, add a step that computes it from x in Desmos (e.g. draw y=1.15x and read it at x = 20, or type 1.15\\cdot20).
5. Desmos LaTeX only: \\frac{a}{b}, \\cdot, \\left( \\right), ^, y=..., x as the unknown, one-letter constants (a=5). No % sign (write 0.15), no units, no words, no \\text.
6. Use 2 to 6 steps, at most 3 Desmos items per step. The last step usually marks the found point with a label, e.g. {"latex": "\\\\left(20,43\\\\right)", "label": "x = 20", "showLabel": true}.
7. "bounds" (only on the first step) must show the important point.
8. "check" plugs the answer back in, e.g. "20 + 23 = 43 ✓".
9. "answer" is exactly the correct answer you were given, as a plain number."""


def user_message(item: dict, with_hint: bool = True) -> str:
    msg = f"Асуулт: {item['question']}\nЗөв хариу: {item['answer']}"
    if with_hint and item.get("rationale"):
        msg += f"\n\nReference solution (hint only, may have mistakes):\n{item['rationale'][:1200]}"
    return msg


def few_shot() -> list[dict]:
    turns = []
    for ex in json.loads(Path(__file__).with_name("examples.json").read_text(encoding="utf-8")):
        turns.append({"role": "user", "parts": [{"text": user_message(ex, with_hint=False)}]})
        turns.append({"role": "model", "parts": [{"text": json.dumps(ex["lesson"], ensure_ascii=False)}]})
    return turns


class RateLimit:
    def __init__(self, rpm: int):
        self.gap = 60.0 / max(rpm, 1)
        self.lock = threading.Lock()
        self.next = 0.0

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            t = max(now, self.next)
            self.next = t + self.gap
        time.sleep(max(0.0, t - now))


def call_gemini(contents: list[dict], key: str, model: str, limit: RateLimit) -> str:
    body = json.dumps({
        "systemInstruction": {"parts": [{"text": INSTRUCTIONS}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.4, "responseMimeType": "application/json", "maxOutputTokens": 2048},
    }).encode()
    url = f"{API}/{model}:generateContent"
    for attempt in range(6):
        limit.wait()
        req = urllib.request.Request(url, data=body, method="POST",
                                     headers={"Content-Type": "application/json", "x-goog-api-key": key})
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                data = json.loads(res.read())
            parts = data["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts if not p.get("thought"))
        except urllib.error.HTTPError as err:
            if err.code in (429, 500, 503):  # busy or over quota: wait and try again
                time.sleep(min(60, 5 * 2**attempt))
                continue
            raise RuntimeError(f"Gemini HTTP {err.code}: {err.read()[:300]!r}") from err
        except (KeyError, IndexError, urllib.error.URLError, TimeoutError):
            time.sleep(3)
    return ""


def pick(pool: list[dict], split: str, n: int, seed: int) -> list[dict]:
    """n questions of one split, with no topic over 30 % (AQuA is mostly percent questions)."""
    rows = [r for r in pool if r["split"] == split]
    random.Random(seed).shuffle(rows)
    cap = max(1, int(n * 0.3))
    count: collections.Counter = collections.Counter()
    out = []
    for r in rows:
        if len(out) >= n:
            break
        if count[r["topic"]] < cap:
            count[r["topic"]] += 1
            out.append(r)
    for r in rows:  # fill up if the caps left room
        if len(out) >= n:
            break
        if r not in out:
            out.append(r)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pool", default="ai/data/raw/aqua_pool.jsonl")
    ap.add_argument("--out", default="ai/data/raw/aqua_lessons_raw.jsonl")
    ap.add_argument("--train", type=int, default=3000, help="train questions to try")
    ap.add_argument("--test", type=int, default=150, help="test questions to try (from AQuA dev/test)")
    ap.add_argument("--model", default=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--rpm", type=int, default=60, help="max Gemini calls per minute (lower it on the free tier)")
    ap.add_argument("--seed", type=int, default=13)
    args = ap.parse_args()

    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise SystemExit("Set GEMINI_API_KEY first (https://aistudio.google.com → Get API key).")

    pool = [json.loads(l) for l in open(args.pool, encoding="utf-8")]
    todo = pick(pool, "test", args.test, args.seed) + pick(pool, "train", args.train, args.seed)
    done = set()
    if Path(args.out).exists():
        done = {json.loads(l)["id"] for l in open(args.out, encoding="utf-8") if l.strip()}
    todo = [r for r in todo if r["id"] not in done]
    print(f"{len(done)} already done · {len(todo)} to go · model {args.model}")

    shots = few_shot()
    limit = RateLimit(args.rpm)
    lock = threading.Lock()
    stats: collections.Counter = collections.Counter()
    start = time.monotonic()

    def work(item: dict) -> None:
        contents = shots + [{"role": "user", "parts": [{"text": user_message(item)}]}]
        reply, why, tries = "", "empty", 0
        for tries in (1, 2):
            reply = call_gemini(contents, key, args.model, limit)
            _, why, _ = verify.check(reply, item["answer"]) if reply else (None, "empty", [])
            if why == "ok":
                break
            feedback = {
                "json": "Your reply was not valid JSON.",
                "schema": "Your JSON broke the format (steps 1–8, text ≤ 400 chars, answer field).",
                "items": "A Desmos item had a bad shape, or no step had a Desmos item.",
                "mongolian": "The step texts must be in Mongolian (Cyrillic).",
                "answer": f"The answer field must be exactly {item['answer']}.",
                "math": f"The Desmos items do not produce {item['answer']}. Fix the equation so the "
                        "intersection / computed value really equals the answer.",
            }.get(why, "Try again.")
            contents = contents + [{"role": "model", "parts": [{"text": reply or "{}"}]},
                                   {"role": "user", "parts": [{"text": feedback + " Return the full corrected JSON."}]}]
        row = {k: item[k] for k in ("id", "split", "topic", "question", "choices", "letter", "answer")}
        row.update(reply=reply, status=why, tries=tries, model=args.model)
        with lock:
            with open(args.out, "a", encoding="utf-8") as fh:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            stats[why] += 1
            n = sum(stats.values())
            if n % 25 == 0 or n == len(todo):
                rate = n / max(time.monotonic() - start, 1) * 60
                print(f"{n}/{len(todo)} · pass {stats['ok'] / n:.0%} · {rate:.0f}/min · {dict(stats)}", flush=True)

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        list(ex.map(work, todo))
    print("done:", dict(stats), "→", args.out)


if __name__ == "__main__":
    main()
