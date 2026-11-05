import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { classView, demoRows, INACTIVE_DAYS, normalizeCode, type StudentRow, summary, view } from './report';

const NOW = Date.parse('2026-11-05T12:00:00Z');
const DAY = 86_400_000;
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();
const row = (over: Partial<StudentRow>): StudentRow => ({
  id: 'x',
  name: 'X',
  username: null,
  joined_at: ago(30),
  answers: 20,
  correct: 15,
  week: 5,
  last_active: ago(1),
  open_mistakes: 0,
  weak_topics: [],
  ...over,
});

describe('status', () => {
  test('ok, struggling, inactive, new', () => {
    expect(view(row({}), NOW).status).toBe('ok');
    expect(view(row({ answers: 20, correct: 8 }), NOW).status).toBe('struggling');
    expect(view(row({ answers: 5, correct: 1 }), NOW).status).toBe('ok'); // too few answers to judge
    expect(view(row({ last_active: ago(INACTIVE_DAYS) }), NOW).status).toBe('inactive');
    expect(view(row({ answers: 0, correct: 0, last_active: null, joined_at: ago(2) }), NOW).status).toBe(
      'new',
    );
    expect(view(row({ answers: 0, correct: 0, last_active: null, joined_at: ago(9) }), NOW).status).toBe(
      'inactive',
    );
  });
  test('accuracy, idle days and topic names', () => {
    const v = view(row({ answers: 3, correct: 2, last_active: ago(3), weak_topics: [14] }), NOW);
    expect(v.accuracy).toBe(67);
    expect(v.idleDays).toBe(3);
    expect(v.weakTopicNames).toEqual(['Тэнцэтгэл биш']);
    expect(view(row({ answers: 0, correct: 0 }), NOW).accuracy).toBeNull();
  });
});

describe('class view', () => {
  test('students who need help come first, then by name', () => {
    const v = classView(
      [
        row({ id: 'a', name: 'Ану' }),
        row({ id: 'b', name: 'Бат', last_active: ago(10) }),
        row({ id: 'c', name: 'Цэцэг', answers: 30, correct: 6 }),
        row({ id: 'd', name: 'Дорж', answers: 0, correct: 0, last_active: null, joined_at: ago(1) }),
      ],
      NOW,
    );
    expect(v.map((x) => x.id)).toEqual(['c', 'b', 'd', 'a']);
  });
  test('summary: totals, help count and the most common weak topics', () => {
    const s = summary(classView(demoRows(NOW), NOW));
    expect(s.students).toBe(4);
    expect(s.activeWeek).toBe(2);
    expect(s.accuracy).toBe(Math.round((100 * (112 + 24 + 33)) / (140 + 60 + 45)));
    expect(s.needHelp).toBe(2); // Сараа struggles, Тэмүүлэн is idle
    expect(s.commonWeak[0]).toEqual({ topic: 'Тэнцэтгэл биш', students: 3 });
  });
  test('an empty class', () => {
    expect(summary([])).toEqual({ students: 0, activeWeek: 0, accuracy: null, needHelp: 0, commonWeak: [] });
  });
});

describe('codes', () => {
  test('normalized like the student types them', () => {
    expect(normalizeCode(' suu-7qk ')).toBe('SUU7QK');
    expect(normalizeCode('SUU7Q')).toBeNull();
    expect(normalizeCode('SUU7QK!')).toBeNull();
  });
  test('the migration makes codes the client accepts (6 chars, no look-alikes)', () => {
    const sql = readFileSync(
      new URL('../../../../supabase/migrations/0022_classes.sql', import.meta.url),
      'utf8',
    );
    const alphabet = /alphabet constant text := '([A-Z0-9]+)'/.exec(sql)?.[1] ?? '';
    expect(alphabet).not.toMatch(/[01OIL]/);
    expect(normalizeCode(alphabet.slice(0, 6))).toBe(alphabet.slice(0, 6));
    expect(sql).toContain("raise exception 'forbidden'");
    expect(sql).toContain('enable row level security');
  });
  test('the latest class_report only reads tables our migrations create', () => {
    const dir = new URL('../../../../supabase/migrations/', import.meta.url);
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    const files = readdirSync(dir)
      .filter((f: string) => f.endsWith('.sql'))
      .sort();
    const all = files.map((f: string) => readFileSync(new URL(f, dir), 'utf8')).join('\n');
    const created = new Set(
      [...all.matchAll(/create table if not exists public\.([a-z_]+)/g)].map((m) => m[1]),
    );
    const last = files
      .filter((f: string) => readFileSync(new URL(f, dir), 'utf8').includes('function public.class_report'))
      .at(-1);
    const fn =
      readFileSync(new URL(last as string, dir), 'utf8').split('function public.class_report')[1] ?? '';
    const used = [...fn.matchAll(/from public\.([a-z_]+)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const t of used) expect(created.has(t)).toBe(true);
  });
});
