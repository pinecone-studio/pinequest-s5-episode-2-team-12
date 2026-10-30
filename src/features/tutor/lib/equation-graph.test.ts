import { describe, expect, test } from 'bun:test';
import { equationLesson, equationReply, extractEquation, nice, replyAgrees } from './equation-graph';

describe('extractEquation', () => {
  test('pulls the equation out of a typed message', () => {
    expect(extractEquation('x: 5(x - 4) + 7 = 3(x + 2) + 5')).toBe('5(x-4)+7=3(x+2)+5');
    expect(extractEquation('x² − 5x + 6 = 0 бол x хэд вэ?')).toBe('x^2-5x+6=0');
    expect(extractEquation('Solve 3x+5=20')).toBe('3x+5=20');
  });
  test('no equation in x → null', () => {
    expect(extractEquation('Сайн уу')).toBeNull();
    expect(extractEquation('2 + 3 = 5')).toBeNull();
    expect(extractEquation('Тойргийн радиус 4 бол талбай хэд вэ?')).toBeNull();
  });
});

describe('equationLesson', () => {
  test('graphs both sides; the crossing is the answer, with a check', () => {
    const l = equationLesson('x: 5(x - 4) + 7 = 3(x + 2) + 5');
    expect(l?.answer).toBe('x = 12');
    expect(l?.steps.map((s) => s.desmos.map((d) => d.latex))).toEqual([
      ['y=5\\left(x-4\\right)+7'],
      ['y=3\\left(x+2\\right)+5'],
      ['(12,47)'],
      ['x=12'],
    ]);
    expect(l?.check).toContain('47');
    const b = l?.steps[2].bounds;
    expect(b && b.left < 12 && b.right > 12 && b.bottom < 47 && b.top > 47).toBe(true);
  });
  test('two roots, fractions, square roots', () => {
    expect(equationLesson('x^2 - 5x + 6 = 0')?.answer).toBe('x = 2, x = 3');
    expect(equationLesson('2x = 5')?.answer).toBe('x = 5/2');
    expect(equationLesson('√x = 3')?.answer).toBe('x = 9');
    expect(equationLesson('x/2 + 1 = 4')?.steps[0].text).toContain('y = x/2+1');
  });
  test('no solution, every x, and a pole that is not a root', () => {
    expect(equationLesson('x + 1 = x + 3')?.answer).toBe('Шийдгүй');
    expect(equationLesson('2(x + 1) = 2x + 2')?.answer).toBe('Бүх x');
    expect(equationLesson('1/x = 0')?.answer).toBe('Шийдгүй');
  });
  test('nice numbers', () => {
    expect(nice(13)).toBe('13');
    expect(nice(-0.5)).toBe('-1/2');
    expect(nice(Math.SQRT2)).toBe('1.4142');
  });
});

describe('equationReply / replyAgrees', () => {
  test('linear: expand, collect, divide, check — same answer as the graph', () => {
    const r = equationReply('5(x - 4) + 7 = 3(x + 2) + 5');
    expect(r?.roots).toEqual([12]);
    expect(r?.text).toContain('$5x - 13 = 3x + 11$');
    expect(r?.text).toContain('$2x = 24$');
    expect(r?.text).toContain('$(12,\\ 47)$');
    // nothing to expand → no expand step
    expect(equationReply('3x + 5 = 20')?.text).not.toContain('Хаалтыг');
  });
  test('a model reply is trusted only when every answer it states is a root', () => {
    expect(replyAgrees('Хариу: 1', [12])).toBe(false);
    expect(replyAgrees('Хариу: $x = 12$', [12])).toBe(true);
    expect(replyAgrees('x = 1, ... Хариу: 12', [12])).toBe(false);
    expect(replyAgrees('no number at all', [12])).toBe(false);
    expect(replyAgrees('x = 5/2', [2.5])).toBe(true);
    expect(replyAgrees('x = 12', null)).toBe(false);
  });
});
