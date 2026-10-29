"""Offline tests for the everyday kit (no Gemini key needed). Run: python3 ai/everyday/test_everyday.py"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
os.chdir(HERE.parent.parent)  # repo root, so build.py finds ai/data/tuning-v2/prompts.json

import build  # noqa: E402
import generate  # noqa: E402
import verify  # noqa: E402
from topics import APP_SECTIONS, CATEGORIES, STYLES  # noqa: E402


def test_selftest() -> None:
    verify.selftest()


def test_sections_match_app() -> None:
    """Every section Suu may name is a real nav label in the app."""
    mn = json.loads(Path("src/messages/mn.json").read_text(encoding="utf-8"))
    labels = {v for v in mn["nav"].values() if isinstance(v, str)}
    missing = [s for s in APP_SECTIONS if s not in labels]
    assert not missing, f"not in src/messages/mn.json nav: {missing}"


def test_jobs() -> None:
    jobs = generate.all_jobs(1)
    assert len(jobs) == sum(len(v) for v in CATEGORIES.values()) * len(STYLES)
    assert len({generate.job_key(j) for j in jobs}) == len(jobs)


def test_generate_build_with_fake_gemini() -> None:
    good = {"turns": [{"user": "Өдөрт хэдэн цаг сурах вэ?", "suu": "Өдөр бүр тогтмол 1 цаг хангалттай. "
                       "«AI төлөвлөгөө» хэсэг хуваарь гаргаж өгнө."}]}
    english = {"turns": [{"user": "how long", "suu": "Study one hour every day and you will be fine."}]}
    fake_section = {"turns": [{"user": "хаана бодох вэ", "suu": "«Супер Сургалт» хэсэгт орж өдөр бүр бодоорой."}]}
    dup = good

    def fake_call(contents, key, model, limit):
        assert len(contents) == 7, "3 examples (6 turns) + the task"
        return json.dumps({"items": [good, english, fake_section, dup]}, ensure_ascii=False)

    generate.call_gemini = fake_call
    # ordinary category, so the crisis / integrity rules don't apply to the fake answers
    real_jobs = generate.all_jobs
    generate.all_jobs = lambda rounds: [("study_habits", s, "cyrillic", 0) for s in CATEGORIES["study_habits"]]
    os.environ["GEMINI_API_KEY"] = "test"
    with tempfile.TemporaryDirectory() as d:
        raw = Path(d) / "raw.jsonl"
        sys.argv = ["generate.py", "--out", str(raw), "--limit", "3", "--rpm", "6000"]
        generate.main()
        rows = [json.loads(l) for l in raw.read_text(encoding="utf-8").splitlines()]
        assert len(rows) == 12
        assert {r["status"] for r in rows} == {"ok", "mongolian", "unknown_section"}, {r["status"] for r in rows}
        generate.main()  # resume: nothing new for the same 3 jobs
        assert len(raw.read_text(encoding="utf-8").splitlines()) > 12  # --limit picks the next 3 jobs

        out = Path(d) / "everyday"
        sys.argv = ["build.py", "--raw", str(raw), "--out", str(out)]
        build.main()
        built = [json.loads(l) for n in ("train", "val", "test") for l in (out / f"{n}.jsonl").read_text().splitlines()]
        assert len(built) == 1, "same question kept once; English and fake-section answers dropped"
        msgs = built[0]["messages"]
        assert msgs[0]["role"] == "system" and msgs[0]["content"] == build.chat_prompt()
        assert [m["role"] for m in msgs[1:]] == ["user", "assistant"]
        assert (out / "review.csv").exists() and (out / "report.md").exists()
    generate.all_jobs = real_jobs


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print("ok", name)
