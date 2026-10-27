import { expect, test } from 'bun:test';
import { render, screen } from '@/test/render';
import { SuuInsights } from './SuuInsights';

const analysis = {
  patterns: [
    { type: 'topic', topic: 13, count: 6 },
    { type: 'rushed', count: 4 },
    { type: 'vocab', word: 'at least', count: 2 },
  ],
  habits: { rushed: 4, slow: 0, desmos: 3 },
  summary: 'Гол хэв маяг: Тэгшитгэлийн систем сэдэвт 6 алдаа.',
  next: ['Хариугаа сонгохоос өмнө 10 секунд зарцуулж шалга.'],
};

function api(body: unknown) {
  const sent: unknown[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    expect(url).toBe('/api/suu/analyze');
    sent.push(JSON.parse(String(init.body)));
    return Response.json(body);
  }) as unknown as typeof fetch;
  return { fn, sent };
}

test('shows Суу’s summary, the patterns with counts and the next steps', async () => {
  const { fn, sent } = api({ analysis, source: 'model', mistakes: 12, answered: 80 });
  render(<SuuInsights demo={false} count={12} fetchImpl={fn} />);
  expect(await screen.findByText(analysis.summary)).toBeTruthy();
  expect(sent).toEqual([{}]); // signed in: the server reads the notebook
  expect(screen.getByText('Суу (AI)')).toBeTruthy();
  const patterns = screen.getByRole('list', { name: 'Давтагдсан хэв маяг' });
  expect(patterns.textContent).toContain('Тэгшитгэлийн систем6');
  expect(patterns.textContent).toContain('Яарсан (30 сек-ээс бага)4');
  expect(patterns.textContent).toContain('«at least» үг2');
  expect(screen.getByText(analysis.next[0])).toBeTruthy();
  expect(screen.getByText(/Сүүлийн 12 алдаа, нийт 80 хариулт/)).toBeTruthy();
});

test('demo browsers send their own data; nothing is asked without mistakes', async () => {
  const { fn, sent } = api({ analysis, source: 'rules', mistakes: 3, answered: 9 });
  const { unmount } = render(<SuuInsights demo count={3} fetchImpl={fn} />);
  expect(await screen.findByText('Дүрмээр гаргасан')).toBeTruthy();
  expect(sent[0]).toEqual({ attempts: [], mistakes: [] });
  unmount();
  const none = api({});
  render(<SuuInsights demo count={0} fetchImpl={none.fn} />);
  expect(screen.queryByText('Суугийн дүгнэлт')).toBeNull();
  expect(none.sent).toHaveLength(0);
});
