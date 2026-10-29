import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@/test/render';
import { DESMOS_AI_LESSONS } from '../lib/desmos-lessons';
import { DesmosCatButton, DesmosSidePanel } from './DesmosSidePanel';

/** Fake Desmos calculator: records what the panel draws (the real script can't load in tests). */
let drawn: Record<string, unknown>[] = [];
beforeEach(() => {
  drawn = [];
  window.Desmos = {
    GraphingCalculator: () => ({
      setBlank: () => {
        drawn = [];
      },
      setExpression: (e: Record<string, unknown>) => void drawn.push(e),
      setMathBounds: () => {},
      destroy: () => {},
    }),
  };
});
afterEach(() => {
  window.Desmos = undefined;
});

/** Fake POST /api/desmos/lesson that records what the panel sent. */
function fakeApi(body: unknown, status = 200) {
  const sent: Record<string, unknown>[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    expect(url).toBe('/api/desmos/lesson');
    sent.push(JSON.parse(String(init.body)));
    return status === 200 ? Response.json(body) : new Response('', { status });
  }) as unknown as typeof fetch;
  return { fn, sent };
}

const lesson = { ...DESMOS_AI_LESSONS[0], id: 'ai' }; // 3x + 5 = 20 → x = 5
const lastStep = lesson.steps.at(-1)!;
const input = { question: 'If 3x+5=20, what is x?\nA) 3\nB) 4\nC) 5\nD) 6', answer: '5' };
const latexDrawn = () => drawn.map((e) => e.latex).filter(Boolean);

describe('DesmosSidePanel', () => {
  test('sends the problem and its answer; before the answer the last step is locked and not drawn', async () => {
    const api = fakeApi({ lesson, source: 'model' });
    render(<DesmosSidePanel input={input} revealed={false} onClose={() => {}} fetchImpl={api.fn} />);
    expect(await screen.findByText(lesson.steps[0].text)).toBeTruthy();
    expect(api.sent).toEqual([input]);
    expect(screen.getByText('AI хичээл')).toBeTruthy();
    expect(screen.queryByText(lastStep.text)).toBeNull();
    expect(screen.getByText(/хариултаа илгээсний дараа нээгдэнэ/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Сүүлийн алхмыг харах' })).toBeNull();
    // walk to the last open step: the locked step's items never reach the graph
    for (let i = 0; i < lesson.steps.length; i++)
      fireEvent.click(screen.getByRole('button', { name: /Дараах/ }));
    for (const it of lastStep.desmos) if (it.latex) expect(latexDrawn()).not.toContain(it.latex);
    expect(screen.queryByText(/Хариу: x = 5/)).toBeNull();
  });

  test('after the answer every step, the check and the answer are shown', async () => {
    const api = fakeApi({ lesson, source: 'sample' });
    const { rerender } = render(
      <DesmosSidePanel input={input} revealed={false} onClose={() => {}} fetchImpl={api.fn} />,
    );
    await screen.findByText(lesson.steps[0].text);
    rerender(<DesmosSidePanel input={input} revealed onClose={() => {}} fetchImpl={api.fn} />);
    expect(screen.getByText('Жишээ хичээл')).toBeTruthy();
    fireEvent.click(screen.getByText(lastStep.text));
    expect(screen.getByText(`Хариу: ${lesson.answer}`)).toBeTruthy();
    await waitFor(() => {
      for (const it of lastStep.desmos) if (it.latex) expect(latexDrawn()).toContain(it.latex);
    });
    expect(api.sent).toHaveLength(1); // revealing doesn't ask again
  });

  test('the tutor can unlock the last step itself', async () => {
    let revealed = false;
    const api = fakeApi({ lesson, source: 'model' });
    render(
      <DesmosSidePanel
        input={input}
        revealed={false}
        onReveal={() => {
          revealed = true;
        }}
        onClose={() => {}}
        fetchImpl={api.fn}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Сүүлийн алхмыг харах' }));
    expect(revealed).toBe(true);
  });

  test('no lesson: the hand-written rows are drawn, and the tip waits for the answer', async () => {
    const api = fakeApi({ lesson: null, source: 'none', reason: 'off' });
    const withRows = { ...input, rows: ['y=3x+5', 'y=20'], tip: 'Огтлолцлын x нь 5' };
    const { rerender } = render(
      <DesmosSidePanel input={withRows} revealed={false} onClose={() => {}} fetchImpl={api.fn} />,
    );
    expect(await screen.findByText('Гараар бичсэн арга')).toBeTruthy();
    await waitFor(() => expect(latexDrawn()).toEqual(['y=3x+5', 'y=20']));
    expect(screen.queryByText(/Огтлолцлын x нь 5/)).toBeNull();
    rerender(<DesmosSidePanel input={withRows} revealed onClose={() => {}} fetchImpl={api.fn} />);
    expect(screen.getByText(/Огтлолцлын x нь 5/)).toBeTruthy();
  });

  test('no lesson and no rows (or the request fails): the calculator is left free', async () => {
    const api = fakeApi(null, 500);
    render(<DesmosSidePanel input={input} revealed={false} onClose={() => {}} fetchImpl={api.fn} />);
    expect(await screen.findByText(/Тооцоолуур чөлөөтэй/)).toBeTruthy();
    expect(latexDrawn()).toEqual([]);
  });

  test('closes with × and with Escape', async () => {
    let closed = 0;
    const api = fakeApi({ lesson, source: 'model' });
    render(<DesmosSidePanel input={input} revealed={false} onClose={() => closed++} fetchImpl={api.fn} />);
    await screen.findByText(lesson.steps[0].text);
    fireEvent.click(screen.getByRole('button', { name: 'Desmos-ийг хаах' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(closed).toBe(2);
  });
});

test('DesmosCatButton says what it does and shows when the panel is open', () => {
  let clicks = 0;
  const { rerender } = render(<DesmosCatButton open={false} onClick={() => clicks++} />);
  fireEvent.click(screen.getByRole('button', { name: 'Desmos-ийг хажууд нээх' }));
  expect(clicks).toBe(1);
  rerender(<DesmosCatButton open onClick={() => clicks++} />);
  expect(screen.getByRole('button', { name: 'Desmos-ийг хаах' }).getAttribute('aria-pressed')).toBe('true');
});

describe('«Өөр хичээл» (another lesson)', () => {
  test('a live lesson can be rewritten: the second request says another: true', async () => {
    const api = fakeApi({ lesson, source: 'model' });
    render(<DesmosSidePanel input={input} revealed={false} onClose={() => {}} fetchImpl={api.fn} />);
    fireEvent.click(await screen.findByRole('button', { name: /Өөр хичээл/ }));
    await waitFor(() => expect(api.sent).toHaveLength(2));
    expect(api.sent[1]).toEqual({ ...input, another: true });
  });

  test('a sample lesson has no such button (it is hand-written, not Suu)', async () => {
    const api = fakeApi({ lesson, source: 'sample' });
    render(<DesmosSidePanel input={input} revealed={false} onClose={() => {}} fetchImpl={api.fn} />);
    await screen.findByText(lesson.steps[0].text);
    expect(screen.queryByRole('button', { name: /Өөр хичээл/ })).toBeNull();
  });
});
