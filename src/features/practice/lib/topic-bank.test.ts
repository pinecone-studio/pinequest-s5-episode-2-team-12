import { expect, test } from 'bun:test';
import { QUESTIONS } from '@/mocks/questions';
import { hardTopicQuestions } from './bank-topics';
import { mapOfficialRow, type OfficialPage } from './official';
import { collectOfficialHardQuestions, officialSolveIssue, realPracticeQuestions } from './topic-bank';

const official = mapOfficialRow({
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
  source: 'digital',
});

const page = (questions = [official], pageCount = 2): OfficialPage => ({
  questions,
  total: 2,
  bankTotal: 1925,
  page: 1,
  pageCount,
});

test('loads every official hard page and never includes medium or duplicate items', async () => {
  const calls: unknown[] = [];
  const result = await collectOfficialHardQuestions(async (filter, size) => {
    calls.push([filter, size]);
    return filter.page === 1
      ? page()
      : page([
          official,
          { ...official, id: 'second', domain: 'geo' },
          { ...official, id: 'medium', difficulty: 2 },
        ]);
  });
  expect(calls).toEqual([
    [{ difficulty: 3, page: 1 }, 500],
    [{ difficulty: 3, page: 2 }, 500],
  ]);
  expect(result?.map((q) => q.id)).toEqual(['ac472881', 'second']);
});

test('a failed official page does not silently return incomplete counts', async () => {
  expect(
    await collectOfficialHardQuestions(async ({ page: index }) => (index === 1 ? page() : null)),
  ).toBeNull();
});

test('empty official data stays empty and mock fallbacks are excluded from real topics', async () => {
  expect(await collectOfficialHardQuestions(async () => page([], 1))).toEqual([]);
  expect(realPracticeQuestions({ questions: QUESTIONS, source: 'mock' })).toEqual([]);
  expect(
    realPracticeQuestions({ questions: QUESTIONS, source: 'supabase' }).every((q) => q.difficulty === 3),
  ).toBe(true);
});

test('official metadata and student-response answers survive mapping without fabricated content', () => {
  expect(official).toMatchObject({
    id: 'ac472881',
    source: 'digital',
    questionType: 'student_response',
    difficulty: 3,
    accepted: ['403'],
  });
  expect(officialSolveIssue(official)).toBeNull();
  expect(officialSolveIssue({ ...official, accepted: [] })).toBeTruthy();
  expect(officialSolveIssue({ ...official, format: 'unsupported' })).toBeTruthy();
  expect(officialSolveIssue({ ...official, promptHtml: '' })).toBeTruthy();
  expect(officialSolveIssue({ ...official, format: 'mcq', choices: [], answer: '' })).toBeTruthy();
  expect(officialSolveIssue({ ...official, explanationHtml: '' })).toBeNull();
});

test('fractions require explicit skill metadata; unrelated official categories are not guessed from prompts', () => {
  const questions = [
    'Equivalent expressions',
    'Percentages',
    'Ratios, rates, proportional relationships, and units',
    'Fractions',
    'Rational expressions',
  ].map((skill) => ({ ...official, skill }));
  expect(hardTopicQuestions(questions, 'fractions').map((q) => q.skill)).toEqual([
    'Fractions',
    'Rational expressions',
  ]);
});
