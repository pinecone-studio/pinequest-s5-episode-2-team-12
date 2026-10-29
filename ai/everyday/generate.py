"""Gemini writes everyday student chats with Suu; every answer is checked by verify.py.

One Gemini call = one (category, subtopic, style) → ITEMS short chats. With all
subtopics × 5 styles × 1 round that is ~400 calls → ~3,200 chats before checks.
Use --rounds 2 for a second, different set. The run can stop and start again.

Usage:
  export GEMINI_API_KEY=...
  python3 ai/everyday/generate.py --limit 10          # quick try: 10 calls
  python3 ai/everyday/generate.py                      # full run
  python3 ai/everyday/generate.py --rounds 2 --rpm 30  # more data, slower
"""

from __future__ import annotations

import argparse
import collections
import hashlib
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
from topics import APP_SECTIONS, CATEGORIES, STYLES  # noqa: E402

API = "https://generativelanguage.googleapis.com/v1beta/models"
ITEMS = 8

SUU = (
    "Suu (Суу) is a friendly cat tutor in a Mongolian SAT Math prep app for high-school students, many outside "
    "Ulaanbaatar. Suu always answers in simple, warm Mongolian (Cyrillic), short (2–5 sentences), practical, "
    "honest, never preachy. Suu is an AI, not a human, and never claims to be ChatGPT or Gemini."
)

RULES = """Rules for Suu's answers:
1. Mongolian Cyrillic only (English words only in brackets, e.g. дундаж (average)). Even if the student writes in English or Latin letters, Suu answers in Cyrillic Mongolian.
2. 2–5 short sentences (max 600 characters). One concrete next step at the end when it fits. At most 1 emoji.
3. Never invent facts: no test dates, fees, test centers, cut-off scores or university requirements. Say "collegeboard.org дээрээс шалгаарай" or "тухайн их сургуулийн сайтаас шалгаарай". No other links. No phone numbers (except crisis rules).
4. Only name app sections from this list, written in «» exactly: {sections}
5. Never promise results ("заавал", "баталгаатай", "100%"). Be encouraging but realistic.
6. Off-topic: one kind sentence, then bring it back to studying or offer the math part.
7. Integrity (leaks, cheating, doing tests for someone): clearly say no ("үгүй", "болохгүй"), explain the risk in one sentence, offer an honest alternative in the app.
8. Safety: never ask for or keep personal data; tell the student not to share it and to tell a trusted adult.
9. Crisis (hopeless, self-harm, abuse): be warm and short, don't lecture, no study advice first. Tell them to talk to a trusted person (ээж аав, багш, итгэдэг том хүн) today, give 108 (хүүхэд, гэр бүлийн тусламжийн утас, үнэгүй, 24 цаг), and 103 if they are in danger right now.
10. Student messages must sound real and varied (different names, places, grades, situations), not copied from the examples."""


def instructions() -> str:
    sections = ", ".join(f"«{k}» ({v})" for k, v in APP_SECTIONS.items())
    return SUU + "\n\n" + RULES.format(sections=sections)


def task(category: str, subtopic: str, style: str, rnd: int) -> str:
    turns = "2 student messages and 2 Suu answers" if style == "multi_turn" else "1 student message and 1 Suu answer"
    return (
        f"Write {ITEMS} different chats between a student and Suu.\n"
        f"Category: {category}\nSubtopic: {subtopic}\n"
        f"How the student writes: {STYLES[style]}\nEach chat: {turns}.\n"
        + (f"This is set #{rnd + 1}: make the situations different from an obvious first set.\n" if rnd else "")
        + 'Return ONLY JSON: {"items": [{"turns": [{"user": "...", "suu": "..."}]}]}'
    )


def few_shot(category: str) -> list[dict]:
    ex = json.loads(Path(__file__).with_name("examples.json").read_text(encoding="utf-8"))
    same = [e for e in ex if e["category"] == category]
    other = [e for e in ex if e["category"] != category and e["category"] != "crisis"]
    picks = (same + other)[:3]
    out = []
    for e in picks:
        out.append({"role": "user", "parts": [{"text": task(e["category"], e["subtopic"], e["style"], 0)
                                                        .replace(str(ITEMS), "1", 1)}]})
        out.append({"role": "model", "parts": [{"text": json.dumps({"items": [{"turns": e["turns"]}]},
                                                                  ensure_ascii=False)}]})
    return out


class RateLimit:
    def __init__(self, rpm: int):
        self.gap, self.lock, self.next = 60.0 / max(rpm, 1), threading.Lock(), 0.0

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            t = max(now, self.next)
            self.next = t + self.gap
        time.sleep(max(0.0, t - now))


def call_gemini(contents: list[dict], key: str, model: str, limit: RateLimit) -> str:
    body = json.dumps({
        "systemInstruction": {"parts": [{"text": instructions()}]},
        "contents": contents,
        "generationConfig": {"temperature": 0.9, "responseMimeType": "application/json", "maxOutputTokens": 8192},
    }).encode()
    for attempt in range(6):
        limit.wait()
        req = urllib.request.Request(f"{API}/{model}:generateContent", data=body, method="POST",
                                     headers={"Content-Type": "application/json", "x-goog-api-key": key})
        try:
            with urllib.request.urlopen(req, timeout=180) as res:
                data = json.loads(res.read())
            parts = data["candidates"][0]["content"]["parts"]
            return "".join(p.get("text", "") for p in parts if not p.get("thought"))
        except urllib.error.HTTPError as err:
            if err.code in (429, 500, 503):
                time.sleep(min(60, 5 * 2**attempt))
                continue
            raise RuntimeError(f"Gemini HTTP {err.code}: {err.read()[:300]!r}") from err
        except (KeyError, IndexError, urllib.error.URLError, TimeoutError):
            time.sleep(3)
    return ""


def parse_items(reply: str) -> list[dict]:
    try:
        data = json.loads(reply)
    except json.JSONDecodeError:
        i, j = reply.find("{"), reply.rfind("}")
        try:
            data = json.loads(reply[i : j + 1]) if 0 <= i < j else {}
        except json.JSONDecodeError:
            return []
    items = data.get("items") if isinstance(data, dict) else None
    return [it for it in items if isinstance(it, dict)] if isinstance(items, list) else []


def all_jobs(rounds: int) -> list[tuple[str, str, str, int]]:
    jobs = [(c, s, st, r) for r in range(rounds) for c, subs in CATEGORIES.items() for s in subs for st in STYLES]
    random.Random(5).shuffle(jobs)
    return jobs


def job_key(job) -> str:
    return "|".join(map(str, job))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="ai/data/raw/everyday_raw.jsonl")
    ap.add_argument("--rounds", type=int, default=1)
    ap.add_argument("--limit", type=int, default=0, help="only this many calls (quick try)")
    ap.add_argument("--model", default=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--rpm", type=int, default=60)
    args = ap.parse_args()

    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise SystemExit("Set GEMINI_API_KEY first (https://aistudio.google.com → Get API key).")
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    done = set()
    if Path(args.out).exists():
        done = {json.loads(l)["job"] for l in open(args.out, encoding="utf-8") if l.strip()}
    jobs = [j for j in all_jobs(args.rounds) if job_key(j) not in done]
    if args.limit:
        jobs = jobs[: args.limit]
    print(f"{len(done)} calls already done · {len(jobs)} to go · ~{len(jobs) * ITEMS} chats · {args.model}")

    limit, lock = RateLimit(args.rpm), threading.Lock()
    stats: collections.Counter = collections.Counter()  # chats by status
    calls = [0]
    start = time.monotonic()

    def work(job) -> None:
        category, subtopic, style, rnd = job
        contents = few_shot(category) + [{"role": "user", "parts": [{"text": task(*job)}]}]
        items = parse_items(call_gemini(contents, key, args.model, limit))
        rows = []
        for i, it in enumerate(items[:ITEMS]):
            item = {"category": category, "subtopic": subtopic, "style": style, "turns": it.get("turns")}
            status = verify.check_item(item)
            rows.append({"job": job_key(job), "id": f"everyday-{hashlib.sha1(job_key(job).encode()).hexdigest()[:10]}-{i}",
                         **item, "status": status, "model": args.model})
        if not rows:  # keep a marker so a resumed run doesn't repeat a call that returned nothing
            rows = [{"job": job_key(job), "id": None, "category": category, "status": "empty"}]
        with lock:
            with open(args.out, "a", encoding="utf-8") as fh:
                for r in rows:
                    fh.write(json.dumps(r, ensure_ascii=False) + "\n")
            for r in rows:
                stats[r["status"]] += 1
            calls[0] += 1
            if calls[0] % 10 == 0 or calls[0] == len(jobs):
                n = sum(stats.values())
                print(f"{calls[0]}/{len(jobs)} calls · {n} chats · pass {stats['ok'] / max(n, 1):.0%} · "
                      f"{calls[0] / max(time.monotonic() - start, 1) * 60:.0f} calls/min", flush=True)

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        list(ex.map(work, jobs))
    print("done:", dict(stats), "→", args.out)


if __name__ == "__main__":
    main()
