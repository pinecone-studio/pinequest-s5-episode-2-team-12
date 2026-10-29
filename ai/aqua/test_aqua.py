"""Offline tests for the AQuA kit (no Gemini key needed). Run: python3 ai/aqua/test_aqua.py"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import build  # noqa: E402
import generate  # noqa: E402
import prepare  # noqa: E402
import verify  # noqa: E402

EXAMPLES = json.loads((HERE / "examples.json").read_text(encoding="utf-8"))


def test_parse_number() -> None:
    cases = {"A)21.5": 21.5, "B)$1,200": 1200, "C)Rs. 500": 500, "D)20%": 20, "E)1/5": 0.2,
             "A)4 and 1": None, "B)x+2": None, "C)12 km": 12, "D)-3": -3}
    for text, want in cases.items():
        got = prepare.parse_number(text)
        assert (got is None and want is None) or abs(got - want) < 1e-9, (text, got)


def test_check_row() -> None:
    good = {"question": "Two friends plan to walk along a 43-km trail, starting at opposite ends of the trail at "
                        "the same time. If Friend P's rate is 15% faster than Friend Q's, how many kilometers will "
                        "Friend P have walked when they pass each other?",
            "options": ["A)21", "B)21.5", "C)22", "D)22.5", "E)23"],
            "rationale": "x + 1.15x = 43\nx = 20\nThen P will have walked 1.15*20=23 km.\nThe answer is E.",
            "correct": "E"}
    item, why = prepare.check_row(good)
    assert why == "ok" and item["answer"] == "23" and item["letter"] == "E", why
    wrong_key = {**good, "correct": "A"}  # rationale says 23, key says 21: noisy row
    assert prepare.check_row(wrong_key)[1] == "key_not_in_rationale"
    prob = {**good, "question": "What is the probability that a fair coin shows heads twice in a row?"}
    assert prepare.check_row(prob)[1] == "topic"


def test_verify_selftest() -> None:
    verify.selftest()


def test_generate_and_build_with_fake_gemini() -> None:
    """First reply fails the math check, the fixed reply passes; build writes app-format rows."""
    ex = EXAMPLES[0]
    bad = json.loads(json.dumps(ex["lesson"]))
    bad["steps"][1]["desmos"][0]["latex"] = "y=44"
    replies = iter([json.dumps(bad, ensure_ascii=False), json.dumps(ex["lesson"], ensure_ascii=False)])
    calls = []

    def fake_call(contents, key, model, limit):
        calls.append(contents)
        return next(replies)

    generate.call_gemini = fake_call
    with tempfile.TemporaryDirectory() as d:
        pool = Path(d) / "pool.jsonl"
        item = {"id": "aqua-train-0", "split": "train", "topic": "rate", "question": ex["question"],
                "choices": ["A) 21", "B) 21.5", "C) 22", "D) 22.5", "E) 23"], "letter": "E",
                "answer": "23", "rationale": "x + 1.15x = 43 ..."}
        pool.write_text(json.dumps(item) + "\n", encoding="utf-8")
        raw = Path(d) / "raw.jsonl"
        sys.argv = ["generate.py", "--pool", str(pool), "--out", str(raw), "--train", "1", "--test", "0",
                    "--rpm", "6000"]
        import os
        os.environ["GEMINI_API_KEY"] = "test"
        generate.main()
        row = json.loads(raw.read_text(encoding="utf-8").splitlines()[0])
        assert row["status"] == "ok" and row["tries"] == 2, row
        assert "do not produce 23" in calls[1][-1]["parts"][0]["text"], "fix request must name the reason"
        # 4 gold examples (8 turns) + the question come before the reply
        assert len(calls[0]) == 2 * len(EXAMPLES) + 1

        out = Path(d) / "aqua"
        sys.argv = ["build.py", "--raw", str(raw), "--out", str(out)]
        build.main()
        rows = [json.loads(l) for f in ("train", "val") for l in (out / f"{f}.jsonl").read_text().splitlines()]
        assert len(rows) == 1
        msgs = rows[0]["messages"]
        assert msgs[0]["content"] == build.DESMOS_PROMPT
        assert msgs[1]["content"] == f"Асуулт: {ex['question']}\nЗөв хариу: 23"
        assert verify.check(msgs[2]["content"], "23")[1] == "ok"


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("ok", name)
