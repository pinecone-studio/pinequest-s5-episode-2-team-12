import { describe, expect, test } from 'bun:test';
import { fireEvent, render, screen, waitFor } from '@/test/render';
import type { Question, TutorContext } from '@/types';
import { chosenText, questionProblem } from '../lib/suu-panel';
import { SuuSidePanel, SuuTutorButton } from './SuuSidePanel';

/** Fake POST /api/tutor that records what the panel sent. */
function fakeApi(text = 'Суугийн хариу', status = 200) {
  const sent: Record<string, unknown>[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    expect(url).toBe('/api/tutor');
    sent.push(JSON.parse(String(init.body)));
    return status === 200 ? Response.json({ text, demo: false }) : new Response('', { status });
  }) as unknown as typeof fetch;
  return { fn, sent };
}

const q: Question = {
  id: 'q1',
  domain: 'alg',
  skill: 'Linear equations',
  difficulty: 1,
  prompt: 'If $3x + 5 = 20$, what is $x$?',
  choices: ['3', '4', '5', '6'],
  answer: 2,
  explain: '',
  hint: '',
};
const ctx = (over: Partial<TutorContext> = {}): TutorContext => ({
  kind: 'question',
  id: q.id,
  title: q.skill,
  problem: questionProblem(q),
  ...over,
});

describe('suu-panel helpers', () => {
  test('the problem lists its choices; the answer reads as a choice', () => {
    expect(questionProblem(q)).toBe('If $3x + 5 = 20$, what is $x$?\nA) 3\nB) 4\nC) 5\nD) 6');
    expect(chosenText(q, '1')).toBe('B) 4');
    expect(chosenText(q, '')).toBeUndefined();
    expect(chosenText({ ...q, choices: undefined }, ' 5 ')).toBe('5');
  });
});

describe('SuuSidePanel', () => {
  test('the button is named «AI багш Суу» and shows whether the panel is open', () => {
    const { rerender } = render(<SuuTutorButton open={false} onClick={() => {}} />);
    const button = screen.getByRole('button', { name: 'AI багш Суу-г хажууд нээх' });
    expect(button.textContent).toContain('AI багш Суу');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    rerender(<SuuTutorButton open onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'AI багш Суу-г хаах' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  test('a quick action sends this problem to Суу and shows the reply', async () => {
    const api = fakeApi('Эхлээд 5-ыг хас.');
    render(<SuuSidePanel context={ctx()} revealed={false} onClose={() => {}} fetchImpl={api.fn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Зөвлөгөө' }));
    expect(await screen.findByText('Эхлээд 5-ыг хас.')).toBeTruthy();
    expect(api.sent[0]).toEqual({
      mode: 'hint',
      message: questionProblem(q),
      raw: false,
      context: { kind: 'question', id: 'q1' },
    });
  });

  test('the full explanation is locked until the student answers; then their answer goes along', async () => {
    const api = fakeApi();
    const { rerender } = render(
      <SuuSidePanel context={ctx()} revealed={false} onClose={() => {}} fetchImpl={api.fn} />,
    );
    const explain = screen.getByRole('button', { name: /Бүтэн тайлбар/ }) as HTMLButtonElement;
    expect(explain.disabled).toBe(true);
    rerender(
      <SuuSidePanel context={ctx({ chosen: 'B) 4' })} revealed onClose={() => {}} fetchImpl={api.fn} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Бүтэн тайлбар' }));
    await waitFor(() => expect(api.sent.length).toBe(1));
    expect(api.sent[0].mode).toBe('explain');
    expect(String(api.sent[0].message)).toContain('Миний хариу: B) 4');
  });

  test('a typed question is sent with the problem, and a new problem starts a new chat', async () => {
    const api = fakeApi('Тийм ээ.');
    const { rerender } = render(
      <SuuSidePanel context={ctx()} revealed={false} onClose={() => {}} fetchImpl={api.fn} />,
    );
    fireEvent.change(screen.getByLabelText('Энэ бодлогын талаар Суу-д асуулт бичих'), {
      target: { value: 'x гэж юу вэ?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Илгээх' }));
    expect(await screen.findByText('Тийм ээ.')).toBeTruthy();
    expect(api.sent[0]).toMatchObject({ raw: true, message: `${questionProblem(q)}\n\nx гэж юу вэ?` });
    rerender(
      <SuuSidePanel
        context={ctx({ id: 'q2', problem: 'What is 2 + 2?' })}
        revealed={false}
        onClose={() => {}}
        fetchImpl={api.fn}
      />,
    );
    await waitFor(() => expect(screen.queryByText('Тийм ээ.')).toBeNull());
  });

  test('a failed reply can be retried; Escape and × close the panel', async () => {
    let fail = true;
    const fn = (async () =>
      fail
        ? new Response('', { status: 500 })
        : Response.json({ text: 'Одоо болсон.' })) as unknown as typeof fetch;
    let closed = 0;
    render(<SuuSidePanel context={ctx()} revealed={false} onClose={() => closed++} fetchImpl={fn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Төстэй бодлого' }));
    const retry = await screen.findByRole('button', { name: 'Дахин оролдох' });
    fail = false;
    fireEvent.click(retry);
    expect(await screen.findByText('Одоо болсон.')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'AI багш Суу-г хаах' }));
    expect(closed).toBe(2);
  });
});
