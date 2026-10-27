import { describe, expect, mock, test } from 'bun:test';

const pushed: string[] = [];
mock.module('next/navigation', () => ({
  useRouter: () => ({
    push: (url: string) => pushed.push(url),
    refresh: () => {},
    replace: () => {},
    back: () => {},
  }),
  usePathname: () => '/bank',
}));

const { fireEvent, render, screen } = await import('@/test/render');
const { OfficialBank } = await import('./OfficialBank');
const { mapOfficialRow } = await import('../lib/official');

const mcq = mapOfficialRow({
  id: 'eccbf957',
  domain: 'Problem-Solving and Data Analysis',
  skill: 'Probability and conditional probability',
  difficulty: 'Easy',
  question_type: 'multiple_choice',
  question_html: '<p>A fair 14-sided die is rolled once.</p>',
  choices: ['1/14', '2/14', '12/14', '13/14'].map((html, i) => ({
    label: 'ABCD'[i],
    html: `<p>${html}</p>`,
  })),
  correct_answer: 'A',
  accepted_answers: ['A'],
  explanation_html: '<p>Choice A is correct because one face shows 2.</p>',
});

const spr = mapOfficialRow({
  id: 'ac472881',
  domain: 'Algebra',
  skill: 'Linear equations in one variable',
  difficulty: 'Hard',
  question_type: 'student_response',
  question_html: '<p>What is the value of s?</p>',
  choices: [],
  correct_answer: '403',
  accepted_answers: ['403'],
  explanation_html: '<p>The correct answer is 403.</p>',
});

const data = { questions: [mcq, spr], total: 2, bankTotal: 1925, page: 1, pageCount: 1 };

describe('OfficialBank', () => {
  test('shows the bank size, the questions and their skills', () => {
    render(<OfficialBank data={data} filter={{ page: 1 }} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Асуултын сан' })).toBeTruthy();
    expect(screen.getByText('1925')).toBeTruthy();
    expect(screen.getByText('2 бодлого олдлоо')).toBeTruthy();
    expect(screen.getByText('A fair 14-sided die is rolled once.')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  test('a wrong choice is marked and the explanation opens', () => {
    render(<OfficialBank data={data} filter={{ page: 1 }} />);
    fireEvent.click(screen.getAllByRole('radio')[1]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Шалгах' })[0]);
    expect(screen.getByText('Буруу. Зөв хариулт: A')).toBeTruthy();
    expect(screen.getByText('Choice A is correct because one face shows 2.')).toBeTruthy();
  });

  test('a typed grid-in answer is graded', () => {
    render(<OfficialBank data={data} filter={{ page: 1 }} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Таны хариулт' }), { target: { value: '403' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Шалгах' })[1]);
    expect(screen.getByText('Зөв! Сайн байна.')).toBeTruthy();
  });

  test('picking a topic pushes it into the URL and resets the page', () => {
    pushed.length = 0;
    render(<OfficialBank data={data} filter={{ page: 3, difficulty: 3 }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Геометр' }));
    expect(pushed).toEqual(['/bank?domain=geo&difficulty=3']);
  });
});
