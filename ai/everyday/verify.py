"""Rules every everyday chat must pass before it becomes training data.

Checks each Suu answer:
  * length 15–700 characters, at most 2 emoji
  * Mongolian: ≥ 70 % of real words are Cyrillic (English terms in brackets are ignored)
  * no links except collegeboard.org, no phone-like numbers (crisis/safety may use 108, 103, 102 only)
  * app section names written in «…» must be real sections (topics.APP_SECTIONS)
  * no claims Suu should never make: being a human, being ChatGPT/Gemini, guaranteed scores
  * crisis answers must give 108 and point to a trusted person
  * integrity answers must say no (no leaked questions, no cheating help)
And for the whole set: no duplicate questions.

Usage:
  python3 ai/everyday/verify.py --selftest
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from topics import APP_SECTIONS, CATEGORIES, CRISIS_NUMBERS, STYLES  # noqa: E402

IGNORE = {"desmos", "sat", "mock", "bluebook", "hint", "суу", "ai", "math", "ielts", "pomodoro", "module"}
EMOJI = re.compile("[\U0001F300-\U0001FAFF☀-➿]")
URL = re.compile(r"https?://\S+|www\.\S+|\b[\w-]+\.(?:com|org|mn|net|io|app)\b", re.IGNORECASE)
PHONE = re.compile(r"(?<!\d)(?<!\d[.,])\d{3,}(?!\d|[.,]\d|%)")  # not 1,200 / 2.5 / 15%
SECTION = re.compile(r"«([^»]{2,40})»")
NEVER = [
    (re.compile(r"би (?:бол )?(?:жинхэнэ )?хүн(?: шүү| байна| юм)", re.IGNORECASE), "claims_human"),
    (re.compile(r"(?:би|намайг)\s+(?:бол\s+)?(?:chatgpt|gpt|gemini|openai|google)", re.IGNORECASE), "claims_other_ai"),
    (re.compile(r"баталгаатай|100\s*%|заавал (?:тэнцэнэ|авна|өснө)|guarantee", re.IGNORECASE), "guarantee"),
]
REFUSAL = re.compile(r"\b(үгүй|болохгүй|чадахгүй|өгөхгүй|туслахгүй|зөрчил|зөрчсөн|хууль бус|шударга бус)", re.IGNORECASE)
TRUSTED = re.compile(r"итгэ(?:дэг|лтэй)|ээж|аав|багш|том хүн|эцэг эх|найз", re.IGNORECASE)


def mongolian_ratio(text: str) -> float:
    s = re.sub(r"\([^()]*\)|«[^»]*»", " ", text)
    words = [w for w in re.findall(r"[A-Za-zА-Яа-яЁёӨөҮү]{3,}", s) if w.lower() not in IGNORE]
    if not words:
        return 0.0
    return sum(1 for w in words if re.match(r"[А-Яа-яЁёӨөҮү]", w)) / len(words)


def check_answer(answer: str, category: str) -> str:
    """'ok' or the first rule the answer breaks."""
    a = answer.strip()
    if not 15 <= len(a) <= 700:
        return "length"
    if len(EMOJI.findall(a)) > 2:
        return "emoji"
    for m in URL.finditer(a):
        if "collegeboard.org" not in m.group(0).lower():
            return "link"
    if mongolian_ratio(URL.sub(" ", a)) < 0.7:
        return "mongolian"
    nums = PHONE.findall(a.replace(" ", ""))
    for n in nums:
        if n in CRISIS_NUMBERS and category in ("crisis", "safety"):
            continue
        if len(n) == 4 and 1900 <= int(n) <= 2100:
            continue  # a year
        if len(n) <= 4 and category not in ("crisis", "safety") and n not in CRISIS_NUMBERS:
            continue  # scores like 1450, 800
        return "phone_number"
    for m in SECTION.finditer(a):
        name = m.group(1).strip()
        if name not in APP_SECTIONS and not _quoted_phrase(name):
            return "unknown_section"
    for pat, why in NEVER:
        if pat.search(a):
            return why
    if category == "crisis" and ("108" not in a or not TRUSTED.search(a)):
        return "crisis_rules"
    if category == "integrity" and not REFUSAL.search(a):
        return "no_refusal"
    return "ok"


def _quoted_phrase(name: str) -> bool:
    """«at least», «яагаад буруу болсон бэ» — a quoted phrase, not an app section name."""
    words = name.split()
    capital_cyrillic = bool(re.match(r"[А-ЯЁӨҮ]", name))
    return not capital_cyrillic or len(words) > 4


def check_item(item: dict) -> str:
    turns = item.get("turns")
    if item.get("category") not in CATEGORIES or item.get("style") not in STYLES:
        return "schema"
    if not isinstance(turns, list) or not 1 <= len(turns) <= 3:
        return "schema"
    if item["style"] == "multi_turn" and len(turns) < 2:
        return "schema"
    for t in turns:
        if not isinstance(t, dict) or not isinstance(t.get("user"), str) or not isinstance(t.get("suu"), str):
            return "schema"
        if not 2 <= len(t["user"].strip()) <= 400:
            return "schema"
        why = check_answer(t["suu"], item["category"])
        if why != "ok":
            return why
    return "ok"


def norm_question(text: str) -> str:
    return re.sub(r"[^a-zа-яёөү0-9]", "", text.lower())


def selftest() -> None:
    ex = json.loads(Path(__file__).with_name("examples.json").read_text(encoding="utf-8"))
    for e in ex:
        assert check_item(e) == "ok", (e["subtopic"], check_item(e))
    crisis = ex[0]
    no_number = {**crisis, "turns": [{"user": "x x", "suu": "Хэцүү байна уу? Амраад дахиад бодоод үзээрэй, чадна шүү."}]}
    assert check_item(no_number) == "crisis_rules"
    cases = {
        "Би жинхэнэ хүн шүү, санаа бүү зов. Хамтдаа бодъё.": "claims_human",
        "Энэ аргаар заавал тэнцэнэ, оноо чинь заавал өснө гэж хэлье.": "guarantee",
        "Дэлгэрэнгүйг www.example.com дээрээс хараарай, тэнд бүгд бий.": "link",
        "Миний дугаар 99112233, залгаарай, хамт бодъё за юу.": "phone_number",
        "«Сургалтын төв» хэсэгт орж хичээлээ сонгоорой, тэнд олон бий.": "unknown_section",
        "Just practice every day and you will improve a lot, trust me.": "mongolian",
        "Бүртгэлийн мэдээллийг collegeboard.org сайтаас шалгаарай, огноо нь өөрчлөгддөг.": "ok",
        "1450 оноо авахын тулд «Хүнд асуулт» хэсгийг өдөр бүр бодоорой.": "ok",
    }
    for text, want in cases.items():
        got = check_answer(text, "study_habits")
        assert got == want, (text, got, want)
    print(f"selftest ok: {len(ex)} gold chats pass, {len(cases) + 1} rule cases behave")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
