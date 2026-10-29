"""Checks a Desmos lesson the way the app does, plus a real math check.

1. App checks (same rules as src/features/tutor/lib/desmos-lesson-parse.ts → parseModelLesson):
   valid JSON, 1–8 steps, text ≤ 400 chars, ≤ 8 Desmos items per step with a safe shape,
   at least one Desmos item, ≥ 60 % Mongolian words, final answer = the correct answer.
2. Math check: the Desmos items are run in a small Desmos-like engine (sympy). The lesson
   passes only if the correct answer *comes out of the graph*: an intersection, a zero,
   a max/min, a solved equation, a computed value or a regression. Writing the answer down
   as a plain number or point does not count.

Usage:
  python3 ai/aqua/verify.py --selftest
  python3 ai/aqua/verify.py --in ai/data/raw/aqua_lessons_raw.jsonl --out ai/data/raw/aqua_lessons_ok.jsonl
"""

from __future__ import annotations

import argparse
import collections
import itertools
import json
import math
import re
import signal
import sys
import threading
from pathlib import Path

import sympy as sp
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

# ---------------------------------------------------------------- app checks (port of parseModelLesson)

LIMITS = {"steps": 8, "text": 400, "items": 8, "latex": 200, "label": 40, "columns": 4, "values": 20}
TECHNIQUES = {
    "intersection_equation", "system_intersection", "quadratic_zeros", "max_min", "slider_constant",
    "linear_regression", "exponential_regression", "statistics", "inequality_system", "circle",
    "function_eval", "function_input", "equivalent_expressions", "distance_midpoint", "percent", "number_theory",
}
IGNORE = {"desmos", "slider", "table", "mean", "median", "distance", "midpoint", "lcm", "gcd",
          "mod", "max", "min", "stdev", "sqrt"}
NUM_RE = re.compile(r"-?\d+(?:\.\d+)?(?:/\d+)?")


def extract_json(text: str):
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*```$", "", t)
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        i, j = t.find("{"), t.rfind("}")
        if i < 0 or j <= i:
            return None
        try:
            return json.loads(t[i : j + 1])
        except json.JSONDecodeError:
            return None


def _to_num(n: str) -> float:
    a, _, b = n.partition("/")
    v = float(a) / float(b) if b else float(a)
    return round(v * 1e6) / 1e6


def norm_answer(answer: str):
    a = str(answer).strip().replace("−", "-").replace("–", "-")
    m = re.fullmatch(r"\(?([A-D])\)?\.?", a)
    if m:
        return ("letter", m.group(1))
    nums = NUM_RE.findall(a)
    if not nums:
        return ("text", a.lower())
    vals = [_to_num(n) for n in nums]
    if len(vals) == 2 and "(" in a:
        return ("point", vals)
    return ("num", vals[0])


def answers_match(a: str, b: str) -> bool:
    x, y = norm_answer(a), norm_answer(b)
    if x[0] != y[0]:
        return False
    if x[0] == "num":
        return abs(x[1] - y[1]) < 1e-6
    return x[1] == y[1]


def mongolian_ratio(texts: list[str]) -> float:
    s = re.sub(r"\([^()]*\)", " ", " ".join(texts))
    words = [w for w in re.findall(r"[A-Za-zА-Яа-яЁёӨөҮү]{3,}", s) if w.lower() not in IGNORE]
    if not words:
        return 0.0
    return sum(1 for w in words if re.match(r"[А-Яа-яЁёӨөҮү]", w)) / len(words)


def clean_item(raw) -> dict | None:
    if not isinstance(raw, dict):
        return None
    if raw.get("type") == "table":
        cols = raw.get("columns")
        if not isinstance(cols, list) or not 1 <= len(cols) <= LIMITS["columns"]:
            return None
        out = []
        for c in cols:
            if not isinstance(c, dict):
                return None
            latex, values = str(c.get("latex", "")).strip(), c.get("values")
            if not latex or len(latex) > LIMITS["label"] or not isinstance(values, list):
                return None
            if len(values) > LIMITS["values"] or any(not isinstance(v, (str, int, float)) for v in values):
                return None
            out.append({"latex": latex, "values": [str(v) for v in values]})
        return {"type": "table", "columns": out}
    latex = raw.get("latex")
    if not isinstance(latex, str) or not latex.strip() or len(latex.strip()) > LIMITS["latex"]:
        return None
    item = {"latex": latex.strip()}
    for k in ("color", "label", "showLabel", "sliderBounds", "lineStyle"):
        if k in raw:
            item[k] = raw[k]
    return item


def app_check(text: str, answer: str) -> tuple[dict | None, str]:
    """(lesson, 'ok') or (None, reason) with the app's reasons: json, schema, items, mongolian, answer."""
    o = extract_json(text) if isinstance(text, str) else text
    if not isinstance(o, dict):
        return None, "json"
    steps = o.get("steps")
    if not isinstance(steps, list) or not 1 <= len(steps) <= LIMITS["steps"] or "answer" not in o:
        return None, "schema"
    clean_steps = []
    for s in steps:
        if not isinstance(s, dict):
            return None, "schema"
        t = s.get("text")
        if not isinstance(t, str) or not t.strip() or len(t.strip()) > LIMITS["text"]:
            return None, "schema"
        items = s.get("desmos", []) or []
        if not isinstance(items, list) or len(items) > LIMITS["items"]:
            return None, "schema"
        cleaned = [clean_item(i) for i in items]
        if any(c is None for c in cleaned):
            return None, "items"
        step = {"text": t.strip(), "desmos": cleaned}
        if isinstance(s.get("bounds"), dict):
            step["bounds"] = s["bounds"]
        clean_steps.append(step)
    if not any(s["desmos"] for s in clean_steps):
        return None, "items"
    if mongolian_ratio([s["text"] for s in clean_steps]) < 0.6:
        return None, "mongolian"
    if not answers_match(str(o["answer"]), answer):
        return None, "answer"
    technique = o.get("technique") if o.get("technique") in TECHNIQUES else None
    return {"technique": technique, "steps": clean_steps, "check": str(o.get("check", "")),
            "answer": str(o["answer"])}, "ok"


# ---------------------------------------------------------------- mini Desmos engine

X, Y = sp.symbols("x y", real=True)
TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)
FUNCS = {
    "MEAN": lambda *a: sp.Add(*_flat(a)) / len(_flat(a)),
    "TOTAL": lambda *a: sp.Add(*_flat(a)),
    "MEDIAN": lambda *a: _median(_flat(a)),
    "SQRT": sp.sqrt,
    "ABS": sp.Abs,
    "LN": sp.log,
    "LOG": lambda v: sp.log(v, 10),
    "EXP": sp.exp,
}


def _flat(args) -> list:
    out = []
    for a in args:
        if isinstance(a, (list, tuple, sp.Tuple)):
            out += _flat(a)
        else:
            out.append(a)
    return out


def _median(vals):
    v = sorted(vals, key=lambda e: float(e))
    n = len(v)
    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2


def _braced(s: str, i: int) -> tuple[str, int]:
    """The text inside the {...} that starts at s[i] == '{', and the index after it."""
    assert s[i] == "{"
    depth = 0
    for j in range(i, len(s)):
        depth += s[j] == "{"
        depth -= s[j] == "}"
        if depth == 0:
            return s[i + 1 : j], j + 1
    raise ValueError("unbalanced braces")


def latex_to_py(latex: str) -> str:
    s = latex.strip()
    s = s.replace("\\left", "").replace("\\right", "")
    s = re.sub(r"\\operatorname\{(\w+)\}", lambda m: m.group(1).upper(), s)
    s = re.sub(r"\\(mean|median|total|sqrt|ln|log|exp)\b", lambda m: "\\" + m.group(1), s)
    # \frac{a}{b} → ((a)/(b)), innermost first
    while "\\frac" in s:
        i = s.rfind("\\frac")
        a, j = _braced(s, i + 5)
        b, k = _braced(s, j)
        s = s[:i] + f"(({a})/({b}))" + s[k:]
    while "\\sqrt{" in s:
        i = s.rfind("\\sqrt{")
        a, j = _braced(s, i + 5)
        s = s[:i] + f"SQRT({a})" + s[j:]
    reps = {
        "\\cdot": "*", "\\times": "*", "\\div": "/", "\\pi": "pi", "\\ln": "LN", "\\log": "LOG",
        "\\exp": "EXP", "\\mean": "MEAN", "\\median": "MEDIAN", "\\total": "TOTAL",
        "\\%": "*0.01", "\\ ": " ", "\\,": " ",
    }
    for a, b in reps.items():
        s = s.replace(a, b)
    s = re.sub(r"\^\{([^{}]*)\}", r"**(\1)", s)  # ^{...}
    s = re.sub(r"_\{(\w+)\}", r"_\1", s)  # x_{1} → x_1
    s = re.sub(r"([A-Za-z])_(\w+)", lambda m: m.group(1) + m.group(2), s)  # x_1 → x1
    s = s.replace("{", "(").replace("}", ")").replace("[", "(").replace("]", ")")
    s = s.replace("^", "**")
    if "\\" in s:
        raise ValueError(f"unknown command in {latex!r}")
    return s


def parse(py: str, env: dict):
    local = {"x": X, "y": Y, "pi": sp.pi, "e": sp.E, **FUNCS, **env}
    return parse_expr(py, local_dict=local, transformations=TRANSFORMS, evaluate=True)


def is_bare_number(py: str) -> bool:
    return re.fullmatch(r"\s*\(?\s*-?\d+(?:\.\d+)?\s*\)?\s*", py) is not None


def real_values(sols) -> list[float]:
    out = []
    for v in sols:
        try:
            c = complex(sp.N(v))
        except (TypeError, ValueError):
            continue
        if abs(c.imag) < 1e-9 and math.isfinite(c.real):
            out.append(c.real)
    return out


class _Timeout(Exception):
    pass


def _alarm(signum, frame):
    raise _Timeout()


def desmos_values(steps: list[dict]) -> tuple[list[float], list[str]]:
    """Every value a student could read off the graph. Returns (values, notes)."""
    env: dict = {}  # constants and functions defined so far (a=5, f(x)=...)
    curves: list = []  # y = f(x)
    eqs: list = []  # other equations in x and y (circles, lines like 2x+3y=6)
    derived: list[float] = []
    notes: list[str] = []
    xs_seen: list[float] = []  # x-values the graph has shown (zeros, intersections, solutions)
    tables: dict[str, list] = {}

    def add(vals, why):
        for v in vals:
            derived.append(float(v))
        if vals:
            notes.append(f"{why}: {', '.join(f'{float(v):g}' for v in vals)}")

    items = [it for s in steps for it in s["desmos"]]
    for it in items:
        if it.get("type") == "table":
            for col in it["columns"]:
                name = latex_to_py(col["latex"]).strip()
                try:
                    tables[name] = [float(parse(latex_to_py(v), env)) for v in col["values"] if str(v).strip()]
                except Exception:  # noqa: BLE001 — a cell we can't read just doesn't count
                    pass
            continue
        latex = it["latex"]
        if re.search(r"\\(?:le|ge|leq|geq|lt|gt)(?![a-z])|<|>", latex):  # not \\left
            continue  # shaded regions: no single value to read
        try:
            if "\\sim" in latex or "~" in latex:
                lhs, rhs = re.split(r"\\sim|~", latex, maxsplit=1)
                add(_regression(latex_to_py(lhs), latex_to_py(rhs), tables, env), "regression")
                continue
            py = latex_to_py(latex)
            if "=" not in py:
                inner = py.strip()
                if inner.startswith("(") and "," in inner and inner.count("(") == 1:
                    continue  # a point the lesson draws: it shows the answer, it doesn't compute it
                if inner.startswith("(") and "," in inner:
                    continue  # a point or a list on its own
                expr = parse(inner, env)
                if expr.free_symbols == {X}:
                    curves.append(expr)
                elif not expr.free_symbols and not is_bare_number(inner):
                    add(real_values([expr]), f"value {latex}")
                continue
            lhs, rhs = py.split("=", 1)
            lhs, rhs = lhs.strip(), rhs.strip()
            fdef = re.fullmatch(r"([a-zA-Z])\(\s*x\s*\)", lhs)
            if fdef and fdef.group(1) not in "xy":
                body = parse(rhs, env)
                env[fdef.group(1)] = sp.Lambda(X, body)
                curves.append(body)
                continue
            if re.fullmatch(r"[a-zA-Z]\d*", lhs) and lhs not in ("x", "y"):
                val = parse(rhs, env)
                if not val.free_symbols:
                    env[lhs] = val
                    if not is_bare_number(rhs):
                        add(real_values([val]), f"{lhs} = {latex}")
                    continue
            left, right = parse(lhs, env), parse(rhs, env)
            if lhs == "y" and Y not in right.free_symbols:
                if right.free_symbols <= {X}:
                    if right.free_symbols:
                        curves.append(right)
                    elif not is_bare_number(rhs):
                        add(real_values([right]), f"line {latex}")
                    else:
                        curves.append(right)  # y = 20: a horizontal line other curves can meet
                continue
            if lhs == "x" and not right.free_symbols:
                if not is_bare_number(rhs):
                    add(real_values([right]), f"vertical line {latex}")
                continue
            eq = sp.expand(left - right)
            fs = eq.free_symbols
            if fs == {X}:
                sols = real_values(sp.solve(eq, X))
                xs_seen.extend(sols)
                add(sols, f"solve {latex}")
            elif fs == {X, Y}:
                eqs.append(eq)
            elif not fs:
                continue
        except _Timeout:
            raise
        except Exception as err:  # noqa: BLE001 — an item we can't run doesn't count
            notes.append(f"skip {latex!r}: {type(err).__name__}")

    # what clicking on the graph shows: intersections, zeros, max/min, and y-values there
    for f in curves:
        if f.free_symbols:
            zs = real_values(sp.solve(f, X))
            xs_seen.extend(zs)
            add(zs, "zero")
            d = sp.diff(f, X)
            if d.free_symbols:
                for c in real_values(sp.solve(d, X)):
                    xs_seen.append(c)
                    add([c, f.subs(X, c)], "max/min")
    for f, g in itertools.combinations(curves, 2):
        if not (f.free_symbols or g.free_symbols):
            continue
        for c in real_values(sp.solve(sp.Eq(f, g), X)):
            xs_seen.append(c)
            add([c, f.subs(X, c)], "intersection")
    # tracing: a student can read any curve's value at an x the graph already showed
    for f in curves:
        if f.free_symbols:
            add(real_values([f.subs(X, c) for c in sorted(set(xs_seen))]), "trace")
    shapes = eqs + [Y - f for f in curves]
    for a, b in itertools.combinations(shapes, 2):
        if a in eqs or b in eqs:
            for sol in sp.solve([a, b], [X, Y], dict=True):
                add(real_values([sol.get(X, sp.nan), sol.get(Y, sp.nan)]), "intersection")
    return derived, notes


def _regression(lhs: str, rhs: str, tables: dict, env: dict) -> list[float]:
    ys = tables.get(lhs)
    xname = next((n for n in tables if n != lhs), None)
    if ys is None or xname is None:
        return []
    xs = tables[xname]
    expr = parse(rhs.replace(xname, "x"), env)
    params = sorted(expr.free_symbols - {X}, key=str)
    if len(params) != 2 or len(xs) != len(ys) or len(xs) < 2:
        return []
    n = len(xs)
    if sp.degree(expr, X) == 1 if expr.is_polynomial(X) else False:
        mx, my = sum(xs) / n, sum(ys) / n
        sxx = sum((a - mx) ** 2 for a in xs)
        if sxx == 0:
            return []
        m = sum((a - mx) * (b - my) for a, b in zip(xs, ys)) / sxx
        return [m, my - m * mx]
    return []


def math_check(lesson: dict, answer: str, seconds: int = 4) -> tuple[bool, list[str]]:
    kind, value = norm_answer(answer)
    if kind != "num":
        return False, ["answer is not a number"]
    if threading.current_thread() is not threading.main_thread():
        # worker threads (generate.py) can't use alarms; build.py re-checks everything with the time limit
        vals, notes = desmos_values(lesson["steps"])
    else:
        old = signal.signal(signal.SIGALRM, _alarm)
        signal.alarm(seconds)
        try:
            vals, notes = desmos_values(lesson["steps"])
        except _Timeout:
            return False, ["timeout"]
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old)
    ok = any(abs(v - value) <= 1e-6 + 1e-4 * max(abs(v), abs(value)) for v in vals)
    return ok, notes


def check(text_or_obj, answer: str) -> tuple[dict | None, str, list[str]]:
    """(lesson, 'ok', notes) when the lesson passes everything, else (None, reason, notes)."""
    lesson, why = app_check(text_or_obj, answer)
    if not lesson:
        return None, why, []
    ok, notes = math_check(lesson, answer)
    return (lesson, "ok", notes) if ok else (None, "math", notes)


# ---------------------------------------------------------------- CLI


def selftest() -> None:
    ex = json.loads(Path(__file__).with_name("examples.json").read_text(encoding="utf-8"))
    for e in ex:
        lesson, why, notes = check(e["lesson"], e["answer"])
        assert lesson, f"gold example {e['id']} failed: {why} {notes}"
    # the same lesson with the answer only written down (no graph that computes it) must fail
    e = ex[0]
    fake = {"technique": "intersection_equation", "steps": [
        {"text": "Хариуг цэгээр тэмдэглэ.", "desmos": [{"latex": f"\\left({e['answer']},0\\right)"}]}],
        "check": "", "answer": e["answer"]}
    assert check(fake, e["answer"])[1] == "math", "a point alone must not pass"
    # a wrong number in an equation must fail
    bad = json.loads(json.dumps(e["lesson"]))
    bad["steps"][1]["desmos"][0]["latex"] = bad["steps"][1]["desmos"][0]["latex"].replace("43", "44")
    assert check(bad, e["answer"])[1] == "math", "a typo in the equation must fail"
    # English text must fail the app's Mongolian check
    eng = json.loads(json.dumps(e["lesson"]))
    for s in eng["steps"]:
        s["text"] = "Write the equation and find the intersection point in Desmos."
    assert check(eng, e["answer"])[1] == "mongolian"
    print(f"selftest ok: {len(ex)} gold lessons pass, fake/typo/English lessons fail")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--in", dest="inp", default="ai/data/raw/aqua_lessons_raw.jsonl")
    ap.add_argument("--out", default="ai/data/raw/aqua_lessons_ok.jsonl")
    args = ap.parse_args()
    if args.selftest:
        selftest()
        return
    reasons: collections.Counter = collections.Counter()
    kept = 0
    with open(args.inp, encoding="utf-8") as fin, open(args.out, "w", encoding="utf-8") as fout:
        for line in fin:
            row = json.loads(line)
            lesson, why, _ = check(row.get("reply", ""), row["answer"])
            reasons[why] += 1
            if lesson:
                kept += 1
                fout.write(json.dumps({**{k: row[k] for k in ("id", "split", "topic", "question", "choices",
                                                            "letter", "answer")}, "lesson": lesson},
                                      ensure_ascii=False) + "\n")
    total = sum(reasons.values())
    print(f"{kept}/{total} lessons pass ({kept / max(total, 1):.0%}) → {args.out}")
    print("why lessons failed:", {k: v for k, v in reasons.most_common() if k != "ok"})


if __name__ == "__main__":
    sys.setrecursionlimit(5000)
    main()
