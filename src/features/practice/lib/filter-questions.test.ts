import { describe, expect, test } from 'bun:test';
import type { Question } from '@/types';
import { filterQuestions } from './filter-questions';

const questions: Question[] = [
  {
    id: 'q1',
    domain: 'alg',
    skill: 'Linear equations',
    difficulty: 1,
    prompt: 'Solve for x: 2x + 3 = 7',
    choices: ['1', '2', '3', '4'],
    answer: 1,
    explain: 'Subtract 3, then divide by 2.',
    hint: 'Isolate x.',
    desmos: { rows: ['y=2x+3'], tip: 'Find the intersection.' },
  },
  {
    id: 'q2',
    domain: 'adv',
    skill: 'Quadratic functions',
    difficulty: 3,
    prompt: 'Find the roots of a quadratic equation.',
    choices: ['0', '1', '2', '3'],
    answer: 2,
    explain: 'Set the equation equal to zero.',
    hint: 'Think about the x-intercepts.',
  },
  {
    id: 'q3',
    domain: 'geo',
    skill: 'Circle geometry',
    difficulty: 3,
    prompt: 'Find the area of a circle.',
    answer: ['25pi'],
    explain: 'Use A = pi r squared.',
    hint: 'Identify the radius.',
    desmos: { rows: ['y=sqrt(25-x^2)'], tip: 'Use the circle graph.' },
  },
  {
    id: 'q4',
    domain: 'psda',
    skill: 'Data analysis',
    difficulty: 2,
    prompt: 'Calculate the mean of a data set.',
    choices: ['2', '3', '4', '5'],
    answer: 2,
    explain: 'Add the values and divide by their count.',
    hint: 'Sum, then divide.',
  },
];

describe('filterQuestions', () => {
  test('filters by domain', () => {
    expect(filterQuestions(questions, { domain: 'alg' }).map((q) => q.id)).toEqual(['q1']);
  });

  test('filters by difficulty', () => {
    expect(filterQuestions(questions, { difficulty: 3 }).map((q) => q.id)).toEqual(['q2', 'q3']);
  });

  test('filters Desmos-supported questions', () => {
    expect(filterQuestions(questions, { desmosOnly: true }).map((q) => q.id)).toEqual(['q1', 'q3']);
  });

  test('filters saved questions', () => {
    expect(
      filterQuestions(questions, {
        savedOnly: true,
        savedIds: ['q2', 'q4'],
      }).map((q) => q.id),
    ).toEqual(['q2', 'q4']);
  });

  test('searches prompt and skill without case sensitivity', () => {
    expect(filterQuestions(questions, { search: 'QUADRATIC' }).map((q) => q.id)).toEqual(['q2']);
    expect(filterQuestions(questions, { search: 'circle' }).map((q) => q.id)).toEqual(['q3']);
  });

  test('combines filters', () => {
    expect(
      filterQuestions(questions, {
        domain: 'geo',
        difficulty: 3,
        desmosOnly: true,
      }).map((q) => q.id),
    ).toEqual(['q3']);
  });

  test('returns all questions when no filter is provided', () => {
    expect(filterQuestions(questions)).toEqual(questions);
  });

  test('Hard Question Zone excludes non-hard questions', () => {
    const hardQuestions = filterQuestions(questions, { difficulty: 3 });

    expect(hardQuestions.every((question) => question.difficulty === 3)).toBe(true);
    expect(hardQuestions.map((question) => question.id)).toEqual(['q2', 'q3']);
  });
});
