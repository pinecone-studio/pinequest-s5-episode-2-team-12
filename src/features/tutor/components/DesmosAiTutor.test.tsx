import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DESMOS_AI_LESSONS } from '../lib/desmos-lessons';
import { DesmosAiTutor } from './DesmosAiTutor';

type Reply = { status?: number; body?: unknown };

/** Fake /api/desmos/lesson: answers from a queue and records what was sent. */
function fakeApi(replies: Reply[]) {
  const sent: Record<string, unknown>[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    expect(url).toBe('/api/desmos/lesson');
    sent.push(JSON.parse(String(init.body)));
    const r = replies.shift() ?? { body: { lesson: null, source: 'none', reason: 'failed' } };
    return r.status ? new Response('', { status: r.status }) : Response.json(r.body);
  }) as unknown as typeof fetch;
  return { fn, sent };
}

/** Fake Desmos calculator: records what the page draws (the real script can't load in tests). */
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

const sample = DESMOS_AI_LESSONS[0];
const modelLesson = { ...DESMOS_AI_LESSONS[3], id: 'ai', title: 'Жагсаалт + статистик' };

function askTyped(question: string, answer = '') {
  fireEvent.change(screen.getByLabelText('Суу-д асуулт бичих'), { target: { value: question } });
  if (answer)
    fireEvent.change(screen.getByLabelText('Зөв хариу (мэдэж байвал)'), { target: { value: answer } });
  fireEvent.click(screen.getByRole('button', { name: 'Асуух' }));
}

describe('DesmosAiTutor', () => {
  test('an example button shows its sample lesson, labelled as a sample', async () => {
    const api = fakeApi([{ body: { lesson: sample, source: 'sample' } }]);
    render(<DesmosAiTutor fetchImpl={api.fn} />);
    fireEvent.click(screen.getByRole('button', { name: sample.title }));
    await waitFor(() => expect(screen.getByText('Жишээ хичээл')).toBeTruthy());
    expect(api.sent[0]).toEqual({ question: sample.question });
    expect(screen.getByText(sample.steps[0].text)).toBeTruthy();
    expect(screen.queryByText('AI хичээл')).toBeNull();
    // step 1 is drawn on the graph
    await waitFor(() => expect(drawn.map((e) => e.latex)).toEqual(['y=3x+5']));
  });

  test('a typed question with an answer gets a model lesson, labelled as AI', async () => {
    const api = fakeApi([{ body: { lesson: modelLesson, source: 'model', answerFrom: 'student' } }]);
    render(<DesmosAiTutor fetchImpl={api.fn} />);
    askTyped('The data set 2, 4, 6 is given. What is the mean?', '4');
    await waitFor(() => expect(screen.getByText('AI хичээл')).toBeTruthy());
    expect(api.sent[0]).toEqual({
      question: 'The data set 2, 4, 6 is given. What is the mean?',
      answer: '4',
    });
    expect(screen.queryByText('Жишээ хичээл')).toBeNull();
    expect(screen.queryByText(/Хариуг Суу өөрөө бодсон/)).toBeNull();
    // walk to the last step: the hand check and the answer appear
    for (let i = 1; i < modelLesson.steps.length; i++)
      fireEvent.click(screen.getByRole('button', { name: /Дараах/ }));
    expect(screen.getByText(new RegExp(`Хариу: ${modelLesson.answer}`))).toBeTruthy();
    // every step up to the current one is on the graph
    const all = modelLesson.steps.flatMap((st) => st.desmos.map((d) => d.latex));
    await waitFor(() => expect(drawn.map((e) => e.latex)).toEqual(all));
  });

  test('when Suu solved the answer itself, the page says so', async () => {
    const api = fakeApi([{ body: { lesson: modelLesson, source: 'model', answerFrom: 'model' } }]);
    render(<DesmosAiTutor fetchImpl={api.fn} />);
    askTyped('What is the mean of 2, 4, 6?');
    await waitFor(() => expect(screen.getByText(/Хариуг Суу өөрөө бодсон/)).toBeTruthy());
    expect(api.sent[0]).toEqual({ question: 'What is the mean of 2, 4, 6?' });
  });

  test('model off → the demo message; model failed → ask with the answer; network error → retry message', async () => {
    const api = fakeApi([
      { body: { lesson: null, source: 'none', reason: 'off' } },
      { body: { lesson: null, source: 'none', reason: 'failed' } },
      { status: 500 },
    ]);
    render(<DesmosAiTutor fetchImpl={api.fn} />);
    askTyped('Some other question?');
    await waitFor(() => expect(screen.getByText(/6 төрлийн асуултыг/)).toBeTruthy());
    askTyped('Another question?');
    await waitFor(() => expect(screen.getByText(/Зөв хариугаа нэмээд дахин асуу/)).toBeTruthy());
    askTyped('Third question?');
    await waitFor(() => expect(screen.getByText('Холболт тасарлаа. Дахин оролдоорой.')).toBeTruthy());
  });

  test('?l=slider opens that sample lesson on load', async () => {
    const slider = DESMOS_AI_LESSONS.find((l) => l.id === 'slider')!;
    const api = fakeApi([{ body: { lesson: slider, source: 'sample' } }]);
    render(<DesmosAiTutor initial="slider" fetchImpl={api.fn} />);
    await waitFor(() => expect(screen.getByText(slider.steps[0].text)).toBeTruthy());
    expect(api.sent[0]).toEqual({ question: slider.question });
  });
});
