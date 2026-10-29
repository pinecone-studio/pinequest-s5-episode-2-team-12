import { afterEach, beforeEach, expect, test } from 'bun:test';
import { QUESTIONS } from '@/mocks/questions';
import { answerTransport, resetAnswerTransport } from '@/test/mock-submissions';
import { act, fireEvent, render, screen } from '@/test/render';
import { mapOfficialRow } from '../lib/official';
import { BankTopics } from './BankTopics';
import { OfficialQuestionCard } from './OfficialQuestionCard';
import { PracticePlayer } from './PracticePlayer';

const question = mapOfficialRow({
  id: 'eccbf957',
  domain: 'Algebra',
  skill: 'Linear equations in one variable',
  difficulty: 'Hard',
  question_type: 'multiple_choice',
  question_html: '<p>First official question</p>',
  choices: [
    { label: 'A', html: '<p>1</p>' },
    { label: 'B', html: '<p>2</p>' },
  ],
  correct_answer: 'A',
  accepted_answers: ['A'],
  explanation_html: '<p>Private explanation</p>',
});
const settled = () => act(async () => {});

test('wrong official answers stay neutral; reveal and hints never resolve; only a saved correct retry resolves', async () => {
  let resolved = 0;
  render(
    <OfficialQuestionCard
      question={question}
      index={1}
      onResolved={() => {
        resolved++;
      }}
    />,
  );
  fireEvent.click(screen.getAllByRole('radio')[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  await settled();
  expect(screen.getByRole('status').textContent).toBe('Буруу байна. Дахин оролдоорой.');
  expect(screen.queryByText('Private explanation')).toBeNull();
  expect(screen.getAllByRole('radio')[0].className).not.toContain('bg-sage');
  expect(screen.getAllByRole('radio')[1].className).not.toContain('bg-danger');
  fireEvent.click(screen.getByRole('button', { name: 'Хариу харах' }));
  expect(screen.getByText('Private explanation')).toBeTruthy();
  expect(resolved).toBe(0);
  expect(answerTransport.calls).toHaveLength(1);
  fireEvent.click(screen.getAllByRole('radio')[0]);
  expect(screen.queryByText('Private explanation')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  await settled();
  expect(resolved).toBe(1);
  expect(answerTransport.calls[1]).toMatchObject({
    qid: question.id,
    questionSource: 'official',
    answer: 'A',
  });
});

test('practice SPR wrong answer hides explanation, allows retry, and hint/view does not persist resolution', async () => {
  let resolved = 0;
  const q = QUESTIONS.find((entry) => entry.id === 'a1')!;
  render(
    <PracticePlayer
      questions={[q]}
      onResolved={() => {
        resolved++;
      }}
    />,
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Хариулт' }), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  await settled();
  expect(screen.getByText('Буруу байна. Дахин оролдоорой.')).toBeTruthy();
  expect(screen.queryByText('Тайлбар')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '🐈 Hint · Сэжүүр' }));
  fireEvent.click(screen.getByRole('button', { name: 'Хариу харах' }));
  expect(resolved).toBe(0);
  expect(answerTransport.calls).toHaveLength(1);
  fireEvent.change(screen.getByRole('textbox', { name: 'Хариулт' }), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  await settled();
  expect(resolved).toBe(1);
});

test('topic Next is explicit, resets solver state, and the last correct answer offers completion', async () => {
  const second = { ...question, id: 'second', promptHtml: '<p>Second official question</p>' };
  render(<BankTopics questions={[]} officialQuestions={[question, second]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Алгебр' }));
  fireEvent.click(screen.getByRole('button', { name: `Бодох: ${question.skill} · ${question.id}` }));
  fireEvent.click(screen.getAllByRole('radio')[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  await settled();
  expect(screen.getByText('First official question')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Дараагийн бодлого →' }));
  expect(screen.getByText('Second official question')).toBeTruthy();
  expect(screen.queryByText('Private explanation')).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getAllByRole('radio').every((radio) => radio.getAttribute('aria-checked') === 'false')).toBe(
    true,
  );
  fireEvent.click(screen.getAllByRole('radio')[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  await settled();
  expect(screen.getByText('Сэдвийн бодлогууд дууслаа!')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Бодлогын жагсаалт руу буцах' }));
  expect(screen.getAllByRole('button', { name: /^Бодох:/ })).toHaveLength(2);
});

test('a correct answer with a failed database save never invokes resolution and can retry persistence', async () => {
  answerTransport.fail = true;
  let resolved = 0;
  render(
    <OfficialQuestionCard
      question={question}
      index={1}
      onResolved={() => {
        resolved++;
      }}
    />,
  );
  fireEvent.click(screen.getAllByRole('radio')[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  await settled();
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(resolved).toBe(0);
  answerTransport.fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Хадгалалтыг дахин оролдох' }));
  await settled();
  expect(resolved).toBe(1);
});

test('practice MCQ mistakes never highlight the right choice before explicit reveal', async () => {
  const q = QUESTIONS.find((entry) => entry.choices && entry.answer === 0)!;
  const { container } = render(<PracticePlayer questions={[q]} />);
  const choices = () =>
    [...container.querySelectorAll('button')].filter((button) => button.querySelector('.flex-1'));
  fireEvent.click(choices()[1]);
  await settled();
  expect(screen.getByText('Буруу байна. Дахин оролдоорой.')).toBeTruthy();
  expect(choices()[0].className).not.toContain('bg-sage');
  expect(choices()[1].className).not.toContain('bg-danger');
  fireEvent.click(screen.getByRole('button', { name: 'Хариу харах' }));
  expect(choices()[0].className).toContain('bg-sage');
  expect(answerTransport.calls).toHaveLength(1);
});

beforeEach(resetAnswerTransport);
afterEach(resetAnswerTransport);
