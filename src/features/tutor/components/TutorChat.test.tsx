import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { TutorContext } from '@/types';
import { TutorChat } from './TutorChat';

let previousDesmos: typeof window.Desmos;
beforeEach(() => {
  previousDesmos = window.Desmos;
  window.Desmos = {
    GraphingCalculator: () => ({ setBlank() {}, setExpression() {}, setMathBounds() {}, destroy() {} }),
  };
});
afterEach(() => {
  window.Desmos = previousDesmos;
});

type Reply = { status?: number; body?: unknown };

/** Fake /api/tutor that answers from a queue and records what was sent. */
function fakeApi(replies: Reply[]) {
  const sent: Record<string, unknown>[] = [];
  const fn = (async (_url: string, init: RequestInit) => {
    sent.push(JSON.parse(String(init.body)));
    const r = replies.shift() ?? { body: { text: 'ok' } };
    return r.status ? new Response('', { status: r.status }) : Response.json(r.body);
  }) as unknown as typeof fetch;
  return { fn, sent };
}

const general: TutorContext = { kind: 'general', title: 'SAT Math' };
const question: TutorContext = {
  kind: 'question',
  id: 'a1',
  title: 'Linear inequalities',
  problem: 'If $3x+5\\le 20$, greatest $x$?',
};

describe('TutorChat', () => {
  test('empty general chat shows starters; a starter is sent as free chat', async () => {
    const api = fakeApi([{ body: { text: 'Нийт 44 асуулт.', model: 'suu' } }]);
    render(<TutorChat context={general} starters={['SAT Math хэдэн асуулттай вэ?']} fetchImpl={api.fn} />);
    fireEvent.click(screen.getByText('SAT Math хэдэн асуулттай вэ?'));
    await waitFor(() => expect(screen.getByText('Нийт 44 асуулт.')).toBeTruthy());
    expect(api.sent[0]).toMatchObject({ raw: true, message: 'SAT Math хэдэн асуулттай вэ?' });
    // a model reply can be rated
    expect(screen.getByLabelText('Тусалсан')).toBeTruthy();
  });

  test('quick action sends the problem in training format', async () => {
    const api = fakeApi([{ body: { text: 'Эхлээд 5-ыг хас.', model: 'suu' } }]);
    render(<TutorChat context={question} fetchImpl={api.fn} />);
    fireEvent.click(screen.getByText('Зөвлөгөө'));
    await waitFor(() => expect(screen.getByText('Эхлээд 5-ыг хас.')).toBeTruthy());
    expect(api.sent[0]).toMatchObject({ mode: 'hint', raw: false, context: { kind: 'question', id: 'a1' } });
    expect(screen.queryByText(/Демо хариу/)).toBeNull();
  });

  test('when Suu cannot be reached (503) the chat says so instead of showing a made-up reply', async () => {
    const api = fakeApi([{ status: 503 }]);
    render(<TutorChat context={question} fetchImpl={api.fn} />);
    fireEvent.click(screen.getByText('Зөвлөгөө'));
    expect(await screen.findByText('Суу одоогоор холбогдохгүй байна, дахин оролдоно уу')).toBeTruthy();
    expect(screen.getByText('Дахин оролдох')).toBeTruthy();
    expect(screen.queryByLabelText('Тусалсан')).toBeNull();
  });

  test('typing + Enter sends; Shift+Enter does not', async () => {
    const api = fakeApi([{ body: { text: 'Сайн уу!' } }]);
    render(<TutorChat context={general} fetchImpl={api.fn} />);
    const box = screen.getByLabelText('Суу-д асуулт бичих');
    fireEvent.change(box, { target: { value: 'Сайн уу' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(api.sent).toHaveLength(0);
    fireEvent.keyDown(box, { key: 'Enter' });
    await waitFor(() => expect(screen.getByText('Сайн уу!')).toBeTruthy());
    expect(api.sent).toHaveLength(1);
  });

  test('an error shows retry, and retry sends the same request again', async () => {
    const api = fakeApi([{ status: 500 }, { body: { text: 'Одоо болсон.' } }]);
    render(<TutorChat context={question} fetchImpl={api.fn} />);
    fireEvent.click(screen.getByText('Бүтэн тайлбар'));
    await waitFor(() => expect(screen.getByText('Дахин оролдох')).toBeTruthy());
    fireEvent.click(screen.getByText('Дахин оролдох'));
    await waitFor(() => expect(screen.getByText('Одоо болсон.')).toBeTruthy());
    expect(api.sent).toHaveLength(2);
    expect(api.sent[1]).toEqual(api.sent[0] as Record<string, unknown>);
  });

  test('send button is disabled for empty input', () => {
    render(<TutorChat context={general} fetchImpl={fakeApi([]).fn} />);
    expect((screen.getByText('Илгээх').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('TutorChat Desmos side panel', () => {
  const lesson = {
    id: 'ai',
    title: 'Огтлолцол',
    question: 'If 3x+5\\le 20, greatest x?',
    answer: '5',
    check: '3·5+5 = 20 ✓',
    match: [],
    steps: [
      { text: 'y = 3x + 5 ба y = 20-ийг зур.', desmos: [{ latex: 'y=3x+5' }, { latex: 'y=20' }] },
      { text: 'Огтлолцлын x = 5.', desmos: [{ latex: '(5,20)' }] },
    ],
  };
  const withDesmos: TutorContext = {
    ...question,
    desmos: { question: 'If 3x+5\\le 20, greatest x?', answer: '5', rows: ['y=3x+5', 'y=20'] },
  };
  /** Both endpoints: /api/desmos/lesson gets the lesson, nothing else is asked here. */
  function api() {
    const urls: string[] = [];
    const fn = (async (url: string) => {
      urls.push(url);
      return Response.json({ lesson, source: 'model' });
    }) as unknown as typeof fetch;
    return { fn, urls };
  }

  test('a bank problem opens guided Desmos beside the chat and retains a compact history menu', async () => {
    const { fn, urls } = api();
    window.Desmos = {
      GraphingCalculator: () => ({ setBlank() {}, setExpression() {}, setMathBounds() {}, destroy() {} }),
    };
    const { container } = render(<TutorChat context={withDesmos} fetchImpl={fn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desmos-ийг хажууд нээх' }));
    expect(await screen.findByText('y = 3x + 5 ба y = 20-ийг зур.')).toBeTruthy();
    expect(urls).toEqual(['/api/desmos/lesson']);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]');
    expect(container.querySelector('details summary')).toBeTruthy();
    // not answered yet: the student can unlock the last step from the panel
    expect(screen.queryByText('Огтлолцлын x = 5.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Сүүлийн алхмыг харах' }));
    expect(screen.getByText('Огтлолцлын x = 5.')).toBeTruthy();
    window.Desmos = undefined;
  });

  test('coming from a wrong answer (chosen), the whole lesson is open; no button without a bank problem', async () => {
    const { fn } = api();
    window.Desmos = {
      GraphingCalculator: () => ({ setBlank() {}, setExpression() {}, setMathBounds() {}, destroy() {} }),
    };
    const { unmount } = render(<TutorChat context={{ ...withDesmos, chosen: '4' }} fetchImpl={fn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Desmos-ийг хажууд нээх' }));
    expect(await screen.findByText('Огтлолцлын x = 5.')).toBeTruthy();
    unmount();
    render(<TutorChat context={question} fetchImpl={fn} />);
    expect(screen.queryByRole('button', { name: 'Desmos-ийг хажууд нээх' })).toBeNull();
    window.Desmos = undefined;
  });

  test('free chat: a typed equation opens the graph by itself (Photomath-style)', async () => {
    const urls: string[] = [];
    const fn = (async (url: string) => {
      urls.push(url);
      return url === '/api/desmos/lesson'
        ? Response.json({ lesson, source: 'solver' })
        : Response.json({ text: 'x = 5', demo: false, model: 'suu' });
    }) as unknown as typeof fetch;
    window.Desmos = {
      GraphingCalculator: () => ({ setBlank() {}, setExpression() {}, setMathBounds() {}, destroy() {} }),
    };
    render(<TutorChat context={general} fetchImpl={fn} />);
    const box = screen.getByLabelText('Суу-д асуулт бичих');
    fireEvent.change(box, { target: { value: '3x + 5 = 20' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(await screen.findByText('Огтлолцлын x = 5.')).toBeTruthy();
    expect(screen.getByText('Графикаар бодсон')).toBeTruthy();
    expect(urls.sort()).toEqual(['/api/desmos/lesson', '/api/tutor']);
    window.Desmos = undefined;
  });

  test('free chat: a model reply can draw the typed question in the panel; demo replies cannot', async () => {
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    const fn = (async (url: string, init: RequestInit) => {
      sent.push({ url, body: JSON.parse(String(init.body)) });
      if (url === '/api/desmos/lesson') return Response.json({ lesson, source: 'model' });
      return Response.json(
        sent.length === 1 ? { text: 'x ≤ 5.', demo: false, model: 'suu' } : { text: 'Демо.', demo: true },
      );
    }) as unknown as typeof fetch;
    window.Desmos = {
      GraphingCalculator: () => ({ setBlank() {}, setExpression() {}, setMathBounds() {}, destroy() {} }),
    };
    render(<TutorChat context={general} fetchImpl={fn} />);
    const box = screen.getByLabelText('Суу-д асуулт бичих');
    fireEvent.change(box, { target: { value: '3x+5 ≤ 20 бол x хамгийн ихдээ хэд вэ?' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    fireEvent.click(await screen.findByRole('button', { name: /Desmos дээр зурж харах/ }));
    // the student asked it themselves, so every step is open
    expect(await screen.findByText('Огтлолцлын x = 5.')).toBeTruthy();
    expect(sent[1]).toEqual({
      url: '/api/desmos/lesson',
      body: { question: '3x+5 ≤ 20 бол x хамгийн ихдээ хэд вэ?' },
    });
    fireEvent.change(box, { target: { value: 'Сайн уу' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    await screen.findByText('Демо.');
    expect(screen.getAllByRole('button', { name: /Desmos дээр зурж харах/ })).toHaveLength(1);
    window.Desmos = undefined;
  });
});
