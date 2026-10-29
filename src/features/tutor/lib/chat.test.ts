import { describe, expect, test } from 'bun:test';
import type { TutorContext } from '@/types';
import { askSuu, newId, patch, requestFor, userBubbleText } from './chat';

const general: TutorContext = { kind: 'general', title: 'SAT Math' };
const question: TutorContext = {
  kind: 'question',
  id: 'a1',
  title: 'Linear inequalities',
  problem: 'If $3x+5\\le 20$ …',
};

describe('requestFor', () => {
  test('quick action sends the problem in training format', () => {
    expect(requestFor({ kind: 'quick', mode: 'hint' }, question)).toEqual({
      mode: 'hint',
      message: 'If $3x+5\\le 20$ …',
      raw: false,
      context: { kind: 'question', id: 'a1' },
    });
  });

  test('quick action without a problem sends nothing', () => {
    expect(requestFor({ kind: 'quick', mode: 'hint' }, general)).toBeNull();
  });

  test('free text is raw; in a question chat the problem goes first', () => {
    expect(requestFor({ kind: 'free', text: '  Сайн уу ' }, general)).toEqual({
      mode: 'explain',
      message: 'Сайн уу',
      raw: true,
      context: undefined,
    });
    expect(requestFor({ kind: 'free', text: 'яагаад?' }, question)?.message).toBe(
      'If $3x+5\\le 20$ …\n\nяагаад?',
    );
  });

  test('a chosen wrong answer is included (mistake review)', () => {
    const ctx: TutorContext = { ...question, kind: 'mistake', chosen: 'B) $6$' };
    expect(requestFor({ kind: 'quick', mode: 'explain' }, ctx)?.message).toContain('Миний хариу: B) $6$');
  });

  test('empty text sends nothing; long text is cut to the API limit', () => {
    expect(requestFor({ kind: 'free', text: '   ' }, general)).toBeNull();
    expect(requestFor({ kind: 'free', text: 'x'.repeat(5000) }, general)?.message.length).toBe(2000);
  });
});

describe('helpers', () => {
  test('user bubble shows the button label for quick actions', () => {
    expect(userBubbleText({ kind: 'quick', mode: 'hint' }, (m) => `[${m}]`)).toBe('[hint]');
    expect(userBubbleText({ kind: 'free', text: ' hi ' }, () => '')).toBe('hi');
  });

  test('ids are unique', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId('m')));
    expect(ids.size).toBe(100);
  });

  test('patch updates only the matching message', () => {
    const list = [
      { id: 'a', role: 'user' as const, text: '1' },
      { id: 'b', role: 'suu' as const, text: '', status: 'pending' as const },
    ];
    const next = patch(list, 'b', { text: 'ok', status: undefined });
    expect(next[1]).toMatchObject({ text: 'ok', status: undefined });
    expect(next[0]).toBe(list[0]);
  });
});

describe('askSuu', () => {
  test('returns text and demo flag', async () => {
    const f = (async () => Response.json({ text: 'Сайн уу!', demo: true })) as unknown as typeof fetch;
    expect(await askSuu({ mode: 'hint', message: 'x', raw: true }, f)).toEqual({
      text: 'Сайн уу!',
      demo: true,
    });
  });

  test('throws on server error or empty reply', async () => {
    const e500 = (async () => new Response('', { status: 500 })) as unknown as typeof fetch;
    const empty = (async () => Response.json({})) as unknown as typeof fetch;
    await expect(askSuu({ mode: 'hint', message: 'x', raw: true }, e500)).rejects.toThrow();
    await expect(askSuu({ mode: 'hint', message: 'x', raw: true }, empty)).rejects.toThrow();
  });
});

describe('chat state sent along (history, reveal, Desmos panel)', () => {
  const msgs = [
    { id: '1', role: 'user' as const, text: 'Сайн уу' },
    { id: '2', role: 'suu' as const, text: 'Сайн уу!' },
    { id: '3', role: 'suu' as const, text: '', status: 'pending' as const },
  ];
  const panel = { step: 0, steps: [{ text: 'Шулуун зур', latex: ['y=2x+1'] }] };

  test('finished messages become history; pending ones and empty extras are left out', () => {
    const req = requestFor({ kind: 'free', text: 'дараа нь?' }, question, { messages: msgs, panel });
    expect(req?.history).toEqual([
      { role: 'user', text: 'Сайн уу' },
      { role: 'suu', text: 'Сайн уу!' },
    ]);
    expect(req?.panel).toEqual(panel);
    expect(req?.revealed).toBeUndefined();
    const bare = requestFor({ kind: 'free', text: 'hi' }, general);
    expect(bare && 'history' in bare).toBe(false);
    expect(bare && 'panel' in bare).toBe(false);
  });

  test('revealed when the student answered (came from a mistake) or unlocked it', () => {
    expect(requestFor({ kind: 'quick', mode: 'hint' }, { ...question, chosen: 'B' })?.revealed).toBe(true);
    expect(requestFor({ kind: 'quick', mode: 'hint' }, question, { revealed: true })?.revealed).toBe(true);
  });

  test('only the last 8 messages go along', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      role: 'user' as const,
      text: `m${i}`,
    }));
    const req = requestFor({ kind: 'free', text: 'x' }, general, { messages: many });
    expect(req?.history?.map((h) => h.text)).toEqual(many.slice(-8).map((m) => m.text));
  });
});

describe('desmosRows (chat → Desmos panel)', () => {
  test('backticked Desmos input only, cleaned, unique, max 6', async () => {
    const { desmosRows } = await import('./chat');
    const text =
      'Эхлээд `y=2x+1` ба `y=-x+7` гэж бич. Огтлолцол `(2, 5)`. ' +
      'Тэнцэтгэл биш: `y ≤ x-3`. Энэ `хариу` биш, `npm install` ч биш, `y=2x+1` давтагдсан.';
    expect(desmosRows(text)).toEqual(['y=2x+1', 'y=-x+7', '(2, 5)', 'y \\le  x-3']);
    expect(desmosRows('no rows here')).toEqual([]);
    const many = Array.from({ length: 9 }, (_, i) => `\`y=${i}x\``).join(' ');
    expect(desmosRows(many)).toHaveLength(6);
  });
});
