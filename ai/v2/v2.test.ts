import { describe, expect, test } from 'bun:test';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SUU_SYSTEM_PROMPT } from '../../src/server/tutor/ollama';
import { SYSTEM_PROMPT } from '../train/export';
import {
  type AnalyzeInput,
  analyze,
  analyzeRows,
  findPatterns,
  type MistakeRow,
  scoreAnalysis,
} from './analyze';
import { toLatin } from './chat-extra';
import { buildV2 } from './export';
import {
  budgets,
  type NoteRules,
  type PlannerInput,
  type PlannerOutput,
  phaseOf,
  plan,
  plannerRows,
  scorePlan,
} from './planner';
import { readJsonl, scoreRow } from './score';
import { CHAT_PROMPT, DAYS, type Row } from './skills';
import { scoreStep, stepcheckRows, verdict } from './stepcheck';

const user = (r: Row) => r.messages[1]?.content ?? '';
const gold = (r: Row) => r.messages[2]?.content ?? '';

test('chat prompt is the one Suu was trained with and the app sends', () => {
  expect(CHAT_PROMPT).toBe(SYSTEM_PROMPT);
  expect(CHAT_PROMPT).toBe(SUU_SYSTEM_PROMPT);
});

describe('planner', () => {
  const rows = plannerRows(5, 300);

  test('every gold plan passes its own checker', () => {
    for (const r of rows) {
      const s = scorePlan(gold(r), JSON.parse(user(r)), r.check?.rules as NoteRules);
      expect({ id: r.id, ...s }).toMatchObject({ id: r.id, pass: true, exact: true });
    }
  });

  test('covers all phases, notes and habits', () => {
    const outs = rows.map((r) => JSON.parse(gold(r)) as PlannerOutput);
    for (const p of ['learn', 'mixed', 'test', 'final']) expect(outs.some((o) => o.phase === p)).toBe(true);
    expect(rows.filter((r) => JSON.parse(user(r)).note).length).toBeGreaterThan(80);
    expect(outs.some((o) => o.week.some((d) => d.tasks.some((t) => t.t === 'desmos')))).toBe(true);
    expect(outs.some((o) => o.week.some((d) => d.tasks.some((t) => t.timed)))).toBe(true);
  });

  test('busy days, extra time, light Sunday and days after the exam', () => {
    const input = { days: [...DAYS], hoursPerDay: 1.5, daysLeft: 5 };
    const b = budgets(input, { busy: ['Мя'], set: { Бя: 180 } });
    expect(b).toEqual({ Да: 90, Мя: 0, Лх: 90, Пү: 90, Ба: 90, Бя: 0, Ня: 0 });
    expect(budgets({ ...input, daysLeft: 30 }, { busy: [], set: {} }).Ня).toBe(45);
    expect(budgets({ ...input, daysLeft: 30, hoursPerDay: 0.5 }, { busy: [], set: {} }).Ня).toBe(15);
  });

  test('phase boundaries', () => {
    expect([1, 3, 4, 14, 15, 42, 43].map(phaseOf)).toEqual([
      'final',
      'final',
      'test',
      'test',
      'mixed',
      'mixed',
      'learn',
    ]);
  });

  test('full tests never on Sunday, never in the last 2 days, always 70 min', () => {
    for (const r of rows) {
      const input = JSON.parse(user(r)) as PlannerInput;
      const o = JSON.parse(gold(r)) as PlannerOutput;
      o.week.forEach((d, i) => {
        if (!d.tasks.some((t) => t.t === 'mock')) return;
        expect(d.day).not.toBe('Ня');
        expect(i).toBeLessThanOrEqual(input.daysLeft - 3);
        expect(d.tasks.find((t) => t.t === 'mock')?.min).toBe(70);
      });
    }
  });

  test('checker catches broken plans', () => {
    const r = rows.find(
      (x) => (x.check?.rules as NoteRules).busy.length && JSON.parse(gold(x)).focus.length >= 2,
    );
    if (!r) throw new Error('no row with a busy day');
    const input = JSON.parse(user(r)) as PlannerInput;
    const rules = r.check?.rules as NoteRules;
    const o = JSON.parse(gold(r)) as PlannerOutput;
    const busyDay = o.week.find((d) => rules.busy.includes(d.day));
    if (!busyDay) throw new Error('busy day missing');

    const ignoredNote = structuredClone(o);
    const d = ignoredNote.week.find((x) => x.day === busyDay.day);
    if (d) Object.assign(d, { min: 30, tasks: [{ t: 'review', min: 30 }] });
    expect(scorePlan(JSON.stringify(ignoredNote), input, rules)).toMatchObject({ busy: false, pass: false });

    const badSum = structuredClone(o);
    const day = badSum.week.find((x) => x.tasks.length > 0);
    if (day?.tasks[0]) day.tasks[0].min += 5;
    expect(scorePlan(JSON.stringify(badSum), input, rules)).toMatchObject({ budget: false, pass: false });

    const swapped = structuredClone(o);
    swapped.focus = [swapped.focus[1], swapped.focus[0], ...swapped.focus.slice(2)] as PlannerOutput['focus'];
    expect(scorePlan(JSON.stringify(swapped), input, rules)).toMatchObject({ focus: false, focusSet: true });

    const english = { ...o, advice: 'Focus on algebra this week and take one practice test.' };
    expect(scorePlan(JSON.stringify(english), input, rules)).toMatchObject({ mongolian: false, pass: false });

    expect(scorePlan(`\`\`\`json\n${gold(r)}\n\`\`\``, input, rules).pass).toBe(true);
    expect(scorePlan('Уучлаарай, ойлгосонгүй.', input, rules).json).toBe(false);
  });

  test('only topics with 5+ answers can be a focus topic', () => {
    const input: PlannerInput = {
      days: [...DAYS],
      daysLeft: 60,
      current: 500,
      target: 600,
      hoursPerDay: 1,
      topics: [
        { id: 4, name: 'Систем', acc: 5, n: 3, sec: 80, trend: 0 },
        { id: 9, name: 'Хувь', acc: 50, n: 12, sec: 80, trend: 0 },
        { id: 17, name: 'Квадрат', acc: 55, n: 20, sec: 130, trend: -4 },
      ],
    };
    const o = plan(input, { busy: [], set: {} });
    expect(o.focus.map((f) => f.id)).toEqual([17, 9]);
    expect(o.check).toEqual([4]);
  });
});

describe('analyze', () => {
  const rows = analyzeRows(5, 300);
  const m = (x: Partial<MistakeRow>): MistakeRow => ({
    q: 'q1',
    topic: 1,
    sec: 60,
    src: 'practice',
    desmos: false,
    times: 1,
    ...x,
  });

  test('every gold analysis passes its own checker', () => {
    for (const r of rows) expect(scoreAnalysis(gold(r), JSON.parse(user(r))).pass).toBe(true);
  });

  test('covers every pattern type and the no-pattern case', () => {
    const types = new Set(
      rows.flatMap((r) => JSON.parse(gold(r)).patterns.map((p: { type: string }) => p.type)),
    );
    expect([...types].sort()).toEqual(['desmos', 'late', 'repeat', 'rushed', 'slow', 'topic', 'vocab']);
    expect(rows.some((r) => JSON.parse(gold(r)).patterns.length === 0)).toBe(true);
  });

  test('thresholds', () => {
    const two = { answered: 10, correct: 8, mistakes: [m({ topic: 4 }), m({ topic: 4 })] };
    expect(findPatterns(two)).toEqual([]);
    const three = { ...two, mistakes: [...two.mistakes, m({ topic: 4, sec: 20 })] };
    expect(findPatterns(three)).toEqual([{ type: 'topic', topic: 4, count: 3 }]);
    // late: 3 of 4 full-test mistakes in questions 16–22 (75% ≥ 60%)
    const late: AnalyzeInput = {
      answered: 22,
      correct: 18,
      mistakes: [16, 18, 21, 3].map((pos, i) => m({ q: `q${i}`, topic: i + 1, src: 'exam', pos })),
    };
    expect(findPatterns(late)).toEqual([{ type: 'late', count: 3 }]);
    late.mistakes.push(
      m({ q: 'q9', topic: 9, src: 'exam', pos: 2 }),
      m({ q: 'q8', topic: 8, src: 'exam', pos: 5 }),
    );
    expect(findPatterns(late)).toEqual([]);
  });

  test('habit counts feed the planner even below the pattern threshold', () => {
    const input = { answered: 5, correct: 3, mistakes: [m({ sec: 10 }), m({ sec: 200, desmos: true })] };
    expect(analyze(input).habits).toEqual({ rushed: 1, slow: 1, desmos: 1 });
  });

  test('checker catches a wrong count and a missed pattern', () => {
    const r = rows.find((x) => JSON.parse(gold(x)).patterns.length >= 2);
    if (!r) throw new Error('no row with 2 patterns');
    const input = JSON.parse(user(r)) as AnalyzeInput;
    const o = JSON.parse(gold(r));
    o.patterns[0].count += 1;
    expect(scoreAnalysis(JSON.stringify(o), input)).toMatchObject({ counts: false, pass: false });
    const missed = JSON.parse(gold(r));
    missed.patterns.pop();
    expect(scoreAnalysis(JSON.stringify(missed), input).recall).toBeLessThan(1);
  });
});

describe('stepcheck', () => {
  const rows = stepcheckRows(5, 400);

  test('gold replies name the first wrong step (or say all steps are right)', () => {
    for (const r of rows) expect(scoreStep(gold(r), Number(r.check?.wrong)).pass).toBe(true);
    const ok = rows.filter((r) => r.check?.wrong === -1).length;
    expect(ok / rows.length).toBeGreaterThan(0.2);
    expect(ok / rows.length).toBeLessThan(0.45);
  });

  test('the wrong step is really different from the corrected one', () => {
    for (const r of rows.filter((x) => Number(x.check?.wrong) >= 0)) {
      const fix = /Зөв нь: \$(.*)\$/.exec(gold(r))?.[1];
      const lines = user(r)
        .split('\n')
        .filter((l) => /^\d\)/.test(l));
      expect(fix).toBeDefined();
      expect(lines[Number(r.check?.wrong)]).not.toBe(`${Number(r.check?.wrong) + 1}) $${fix}$`);
    }
  });

  test('verdict reading', () => {
    expect(verdict('Алдаа **2-р алхамд** байна.')).toEqual({ kind: 'step', step: 1 });
    expect(verdict('Алдаа 3 р алхамд')).toEqual({ kind: 'step', step: 2 });
    expect(verdict('Бүх алхам зөв ✓')).toEqual({ kind: 'ok' });
    expect(verdict('Сайн байна')).toEqual({ kind: 'none' });
    expect(scoreStep('Бүх алхам зөв ✓', 1).pass).toBe(false);
  });
});

test('Latin letters as students type them', () => {
  expect(toLatin('Зөвлөгөө өгөөч')).toBe('zuvluguu uguuch');
  expect(toLatin('Хариуг нь битгий хэлээрэй.')).toBe('hariug ni bitgii heleerei.');
});

describe('export', () => {
  const d = buildV2();

  test('test prompts never appear in train (val is only for the loss curve)', () => {
    const trained = new Set(d.train.map(user));
    for (const r of d.test) expect(trained.has(user(r))).toBe(false);
    // generated skills are also kept apart from val; chat test = v1 eval, built from the v1 val questions
    const val = new Set(d.val.map(user));
    for (const r of d.test.filter((x) => x.skill !== 'chat')) expect(val.has(user(r))).toBe(false);
  });

  test('shapes: train/val end with the answer, test has only system + user', () => {
    for (const r of [...d.train, ...d.val]) {
      expect(r.messages[0]?.role).toBe('system');
      expect(r.messages[1]?.role).toBe('user');
      expect(r.messages.at(-1)?.role).toBe('assistant');
    }
    for (const r of d.test) expect(r.messages.map((x) => x.role)).toEqual(['system', 'user']);
    expect(d.test.filter((r) => r.skill === 'chat').every((r) => typeof r.check?.mode === 'string')).toBe(
      true,
    );
  });

  test('every skill is in every split', () => {
    for (const split of [d.train, d.val, d.test])
      for (const s of ['chat', 'planner', 'analyze', 'stepcheck'])
        expect(split.some((r) => r.skill === s)).toBe(true);
  });

  test('gold answers of the generated test rows score 100%', () => {
    for (const r of d.test.filter((x) => x.skill !== 'chat')) {
      const s = scoreRow(r, String(r.check?.gold));
      expect({ id: r.id, pass: s.pass }).toEqual({ id: r.id, pass: 1 });
    }
  });

  test('committed data files match the generator (run `bun ai/v2/export.ts` after changes)', () => {
    const dir = join(import.meta.dir, '..', 'data', 'tuning-v2');
    for (const [name, rows] of Object.entries(d)) {
      const file = readJsonl<Row>(join(dir, `${name}.jsonl`));
      expect(file.length).toBe(rows.length);
      expect(file.map((r) => r.id)).toEqual(rows.map((r) => r.id));
    }
  });
});

test('the scorer runs with plain bun and no node_modules (as in Colab)', () => {
  const root = mkdtempSync(join(tmpdir(), 'suu-v2-'));
  const repo = join(import.meta.dir, '..', '..');
  mkdirSync(join(root, 'ai', 'pipeline', 'templates'), { recursive: true });
  cpSync(
    join(repo, 'ai', 'pipeline', 'templates', 'shared.ts'),
    join(root, 'ai/pipeline/templates/shared.ts'),
  );
  for (const f of ['skills', 'planner', 'analyze', 'stepcheck', 'score'])
    cpSync(join(import.meta.dir, `${f}.ts`), join(root, 'ai', 'v2', `${f}.ts`));
  const tests = join(repo, 'ai', 'data', 'tuning-v2', 'test.jsonl');
  const outs = readJsonl<Row>(tests)
    .filter((r) => r.skill !== 'chat')
    .map((r) => JSON.stringify({ id: r.id, output: r.check?.gold }));
  writeFileSync(join(root, 'out.jsonl'), `${outs.join('\n')}\n`);
  const p = Bun.spawnSync(['bun', join(root, 'ai/v2/score.ts'), tests, join(root, 'out.jsonl')], {
    cwd: root,
  });
  expect(existsSync(join(root, 'node_modules'))).toBe(false);
  expect(p.exitCode).toBe(0);
  const summary = JSON.parse(p.stdout.toString());
  expect(summary.planner.pass).toBe(100);
  expect(summary.analyze.pass).toBe(100);
  expect(summary.stepcheck.pass).toBe(100);
  expect(readFileSync(join(root, 'out.jsonl'), 'utf8').length).toBeGreaterThan(0);
});

describe('Colab notebook (ai/train/suu_v2.ipynb)', () => {
  const path = join(import.meta.dir, '..', 'train', 'suu_v2.ipynb');
  const nb = JSON.parse(readFileSync(path, 'utf8')) as {
    cells: { cell_type: string; source: string[] }[];
  };
  const code = nb.cells.filter((c) => c.cell_type === 'code').map((c) => c.source.join(''));

  test('every file it downloads exists in the repo', () => {
    const files = /FILES = \[([\s\S]*?)\]/.exec(code.join('\n'))?.[1] ?? '';
    const paths = [...files.matchAll(/"([^"]+)"/g)].map((m) => m[1] as string);
    expect(paths.length).toBeGreaterThan(8);
    for (const p of paths) expect(existsSync(join(import.meta.dir, '..', '..', p))).toBe(true);
  });

  test('uses the same Qwen chat markers as the training data', () => {
    const all = code.join('\n');
    expect(all).toContain('instruction_part="<|im_start|>user\\n"');
    expect(all).toContain('response_part="<|im_start|>assistant\\n"');
  });

  test('every code cell is valid Python (shell lines removed)', () => {
    const py = Bun.which('python3');
    if (!py) return;
    for (const [i, src] of code.entries()) {
      const body = src
        .split('\n')
        .map((l) => (/^\s*[!%]/.test(l) ? `${l.match(/^\s*/)?.[0] ?? ''}pass` : l))
        .join('\n');
      const p = Bun.spawnSync([py, '-c', 'import sys; compile(sys.stdin.read(), "cell", "exec")'], {
        stdin: new TextEncoder().encode(body),
      });
      expect({ cell: i, err: p.stderr.toString() }).toEqual({ cell: i, err: '' });
    }
  });
});
