import { afterEach, beforeEach, expect, test } from 'bun:test';
import { QUESTIONS } from '@/mocks/questions';
import { resetAnswerTransport } from '@/test/mock-submissions';
import { fireEvent, render, screen } from '@/test/render';
import type { Question } from '@/types';
import { hardTopicQuestions } from '../lib/bank-topics';
import { BankTopics } from './BankTopics';

const questions: Question[] = [
  {
    ...QUESTIONS[0],
    id: 'algebra',
    domain: 'alg',
    difficulty: 3,
    skill: 'Linear equations',
    prompt: 'Hard algebra prompt',
    choices: ['Correct', 'Incorrect'],
    answer: 0,
    explain: 'Algebra explanation',
  },
  { ...QUESTIONS[0], id: 'easy', domain: 'alg', difficulty: 1, prompt: 'Easy algebra prompt' },
  {
    ...QUESTIONS[0],
    id: 'fraction',
    domain: 'adv',
    difficulty: 3,
    skill: 'Fractions',
    prompt: 'Fraction prompt',
  },
  {
    ...QUESTIONS[0],
    id: 'geometry',
    domain: 'geo',
    difficulty: 3,
    skill: 'Circles',
    prompt: 'Geometry prompt',
  },
];

test('hard topic filtering uses difficulty and domain or fraction skill metadata', () => {
  expect(hardTopicQuestions(questions, 'alg').map((q) => q.id)).toEqual(['algebra']);
  expect(hardTopicQuestions(questions, 'fractions').map((q) => q.id)).toEqual(['fraction']);
  expect(hardTopicQuestions(questions, 'adv').map((q) => q.id)).toEqual(['fraction']);
  expect(hardTopicQuestions(questions, 'psda')).toEqual([]);
});

test('shows five topic cards and only the selected topic hard questions', () => {
  render(<BankTopics questions={questions} />);
  expect(screen.getByRole('heading', { name: 'Асуултын сан' })).toBeTruthy();
  expect(screen.queryByText('Hard algebra prompt')).toBeNull();
  expect(screen.getByRole('link', { name: /Албан ёсны асуултын сан/ }).getAttribute('href')).toBe(
    '/bank?view=official',
  );
  for (const name of ['Алгебр', 'Энгийн бутархай', 'Ахисан математик', 'Өгөгдөл ба бодлого', 'Геометр']) {
    expect(screen.getByRole('button', { name })).toBeTruthy();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Алгебр' }));
  expect(screen.getByText('Hard algebra prompt')).toBeTruthy();
  expect(screen.queryByText('Easy algebra prompt')).toBeNull();
  expect(screen.queryByText('Geometry prompt')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '← Бүх сэдэв' }));
  fireEvent.click(screen.getByRole('button', { name: 'Энгийн бутархай' }));
  expect(screen.getByText('Fraction prompt')).toBeTruthy();
  expect(screen.queryByText('Hard algebra prompt')).toBeNull();
});

test('solves a selected question with the player and resets when changing topic', () => {
  render(<BankTopics questions={questions} />);
  fireEvent.click(screen.getByRole('button', { name: 'Алгебр' }));
  fireEvent.click(screen.getByRole('button', { name: 'Бодох: Linear equations' }));
  fireEvent.click(screen.getByRole('button', { name: /^A\s*Correct$/ }));
  expect(screen.getByText('Algebra explanation')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '← Сэдвийн бодлогууд' }));
  fireEvent.click(screen.getByRole('button', { name: 'Бодох: Linear equations' }));
  expect(screen.queryByText('Algebra explanation')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '← Бүх сэдэв' }));
  fireEvent.click(screen.getByRole('button', { name: 'Геометр' }));
  expect(screen.getByText('Geometry prompt')).toBeTruthy();
  expect(screen.queryByText('Hard algebra prompt')).toBeNull();
});

test('empty topics stay selectable and show an empty state', () => {
  render(<BankTopics questions={[]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Өгөгдөл ба бодлого' }));
  expect(screen.getByRole('status').textContent).toContain(
    'Өгөгдөл ба бодлого сэдэвт хүнд бодлого одоогоор алга байна.',
  );
});

test('topic lists have no redundant filters and retain individual solving', () => {
  render(<BankTopics questions={questions} />);
  fireEvent.click(screen.getByRole('button', { name: 'Алгебр' }));
  expect(screen.queryByRole('textbox', { name: 'Хайх' })).toBeNull();
  expect(screen.queryByRole('navigation', { name: 'Сэдэв сонгох' })).toBeNull();
  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Бодох: Linear equations' })).toBeTruthy();
});

test('all topic scenes use only the unchanged original Suu sitting artwork', () => {
  const { container } = render(<BankTopics questions={questions} />);
  const images = [...container.querySelectorAll('.bank-mascot image')];
  expect(images).toHaveLength(5);
  expect(images.every((image) => image.getAttribute('href') === '/brand/suu-sitting.webp')).toBe(true);
  expect(container.querySelectorAll('.bank-mascot-prop')).toHaveLength(5);
  expect(container.querySelectorAll('.bank-mascot[aria-hidden="true"]')).toHaveLength(5);
});

// Existing official-bank examples, rendered through the same interface as the full official bank.
const { mapOfficialRow } = await import('../lib/official');
const officialMcq = mapOfficialRow({
  id: 'eccbf957',
  domain: 'Problem-Solving and Data Analysis',
  skill: 'Probability and conditional probability',
  difficulty: 'Hard',
  question_type: 'multiple_choice',
  question_html: '<p>A fair 14-sided die is rolled once.</p>',
  choices: ['1/14', '2/14', '12/14', '13/14'].map((html, i) => ({
    label: 'ABCD'[i],
    html: `<p>${html}</p>`,
  })),
  correct_answer: 'A',
  accepted_answers: ['A'],
  explanation_html: '<p>Choice A is correct because one face shows 2.</p>',
  source: 'digital',
});
const officialSpr = mapOfficialRow({
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
  source: 'legacy',
});

test('official hard MCQ selection, wrong/correct submission, explanations, and back navigation', () => {
  render(
    <BankTopics
      questions={[]}
      officialQuestions={[
        officialMcq,
        { ...officialMcq, id: 'easy', difficulty: 1, promptHtml: '<p>Easy official prompt</p>' },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Өгөгдөл ба бодлого' }));
  expect(screen.getByText(/College Board · eccbf957 · digital/)).toBeTruthy();
  expect(screen.queryByText('Easy official prompt')).toBeNull();
  expect(screen.queryByRole('radio')).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Бодох: Probability and conditional probability · eccbf957' }),
  );
  fireEvent.click(screen.getAllByRole('radio')[1]);
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  expect(screen.getByRole('status').textContent).toContain('Буруу');
  expect(screen.queryByText('Choice A is correct because one face shows 2.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Хариу харах' }));
  expect(screen.getByText('Choice A is correct because one face shows 2.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '← Сэдвийн бодлогууд' }));
  expect(screen.queryByRole('radio')).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Бодох: Probability and conditional probability · eccbf957' }),
  );
  fireEvent.click(screen.getAllByRole('radio')[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  expect(screen.getByRole('status').textContent).toContain('Зөв!');
  fireEvent.click(screen.getByRole('button', { name: '← Сэдвийн бодлогууд' }));
  fireEvent.click(screen.getByRole('button', { name: '← Бүх сэдэв' }));
  expect(screen.getByRole('button', { name: 'Энгийн бутархай' })).toBeTruthy();
});

test('official student-produced responses use the existing numeric answer checker', () => {
  render(<BankTopics questions={[]} officialQuestions={[officialSpr]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Алгебр' }));
  fireEvent.click(screen.getByRole('button', { name: 'Бодох: Linear equations in one variable · ac472881' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Таны хариулт' }), { target: { value: '403.0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Шалгах' }));
  expect(screen.getByRole('status').textContent).toContain('Зөв!');
  expect(screen.getByText('The correct answer is 403.')).toBeTruthy();
});

test('missing answers and unknown official formats are visible but cannot be graded', () => {
  render(
    <BankTopics
      questions={[]}
      officialQuestions={[
        { ...officialSpr, accepted: [] },
        { ...officialSpr, id: 'unknown', format: 'unsupported' },
      ]}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Алгебр' }));
  for (const button of screen.getAllByRole('button', { name: /^Бодох:/ }))
    expect(button.hasAttribute('disabled')).toBe(true);
  expect(screen.getByText('Зөв хариултын өгөгдөл дутуу байна.')).toBeTruthy();
  expect(screen.getByText('Энэ асуултын хэлбэр одоогоор дэмжигдээгүй.')).toBeTruthy();
});

beforeEach(resetAnswerTransport);
afterEach(resetAnswerTransport);
