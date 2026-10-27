import { describe, expect, test } from 'bun:test';
import { PHASES } from '@/mocks/meta';
import { fireEvent, render, screen, waitFor, within } from '@/test/render';
import { PlannerView } from './PlannerView';

const dates = [
  { d: '2026-12-05', reg: '', late: '' },
  { d: '2027-03-13', reg: '', late: '' },
];
const plan = {
  phase: 'mixed',
  focus: [{ id: 13, why: '40% зөв (10 бодлого), сүүлд 12 пункт буурсан' }],
  check: [12],
  week: [
    { day: 'Мя', min: 0, tasks: [] },
    {
      day: 'Лх',
      min: 90,
      tasks: [
        { t: 'desmos', topic: 13, min: 25 },
        { t: 'practice', topic: 13, min: 50, timed: true },
        { t: 'cards', min: 15 },
      ],
    },
  ],
  advice: 'Шалгалт хүртэл 39 өдөр байна — сул сэдвээ давтаж, долоо хоногт 1 бүтэн тест өг.',
};

function api(source: 'model' | 'rules', status = 200) {
  const sent: Record<string, unknown>[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    expect(url).toBe('/api/suu/planner');
    sent.push(JSON.parse(String(init.body)));
    return status === 200
      ? Response.json({ plan, source, input: { days: ['Мя', 'Лх'], daysLeft: 39, topics: [] } })
      : new Response('', { status });
  }) as unknown as typeof fetch;
  return { fn, sent };
}

describe('PlannerView', () => {
  test('sends the form, weak topics and note; shows Суу’s week with links, focus and advice', async () => {
    const { fn, sent } = api('model');
    render(
      <PlannerView
        dates={dates}
        phases={PHASES}
        roadmap={{ demo: false, server: null, ids: [] }}
        fetchImpl={fn}
      />,
    );
    fireEvent.change(screen.getByLabelText('Сэдэв нэмэх'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Тэмдэглэл (заавал биш)'), {
      target: { value: 'Мягмар гарагт дугуйлантай.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Төлөвлөгөө гаргах' }));

    expect(await screen.findByText('Суу (AI)')).toBeTruthy();
    expect(sent[0]).toMatchObject({ weakIds: [12], note: 'Мягмар гарагт дугуйлантай.', hoursPerDay: 1.5 });
    expect(sent[0].attempts).toBeUndefined(); // signed in: the server reads the student's data
    expect(screen.getByText('Амралт')).toBeTruthy();
    const week = screen.getByRole('list', { name: 'Энэ долоо хоногийн хуваарь' });
    const desmos = within(week).getByRole('link', { name: /Desmos арга: Тэгшитгэлийн систем/ });
    expect(desmos.getAttribute('href')).toBe('/desmos');
    expect(
      within(week)
        .getByRole('link', { name: /Дасгал.*цаг хэмжинэ/ })
        .getAttribute('href'),
    ).toBe('/practice?timed=1');
    expect(screen.getByText(/40% зөв/)).toBeTruthy();
    expect(screen.getByText(/Бодлого цөөн/).parentElement?.textContent).toContain('Квадрат тэгшитгэл');
    expect(screen.getByText(plan.advice)).toBeTruthy();
  });

  test('demo students send their own data; the rules label shows; errors say so', async () => {
    const ok = api('rules');
    const { unmount } = render(
      <PlannerView
        dates={dates}
        phases={PHASES}
        roadmap={{ demo: true, server: null, ids: [] }}
        fetchImpl={ok.fn}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Төлөвлөгөө гаргах' }));
    expect(await screen.findByText('Дүрмээр гаргасан')).toBeTruthy();
    expect(ok.sent[0]).toMatchObject({ attempts: [], mistakes: [] });
    unmount();
    const bad = api('rules', 500);
    render(<PlannerView dates={dates} phases={PHASES} fetchImpl={bad.fn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Төлөвлөгөө гаргах' }));
    await waitFor(() => expect(screen.getByText(/гаргаж чадсангүй/)).toBeTruthy());
  });
});
