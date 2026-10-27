import { describe, expect, test } from 'bun:test';
import { cleanSearch, mapOfficialRow, officialFilterToParams, parseOfficialFilter } from './official';

describe('parseOfficialFilter', () => {
  test('reads valid params', () => {
    expect(
      parseOfficialFilter({ domain: 'geo', skill: 'Circles', difficulty: '3', q: ' radius ', page: '2' }),
    ).toEqual({ domain: 'geo', skill: 'Circles', difficulty: 3, search: 'radius', page: 2 });
  });

  test('drops unknown values and a skill from another domain', () => {
    expect(parseOfficialFilter({ domain: 'xyz', difficulty: '9', page: '-4' })).toEqual({
      domain: undefined,
      skill: undefined,
      difficulty: undefined,
      search: undefined,
      page: 1,
    });
    expect(parseOfficialFilter({ domain: 'alg', skill: 'Circles' }).skill).toBeUndefined();
  });

  test('round-trips through URL params, leaving defaults out', () => {
    const filter = parseOfficialFilter({ domain: 'adv', difficulty: '1', page: '1' });
    expect(officialFilterToParams(filter)).toBe('domain=adv&difficulty=1');
  });
});

test('cleanSearch removes PostgREST filter characters', () => {
  expect(cleanSearch('50% (of), x_1*')).toBe('50 of x 1');
});

test('mapOfficialRow converts a table row into a display-ready question', () => {
  const q = mapOfficialRow({
    id: 'eccbf957',
    domain: 'Problem-Solving and Data Analysis',
    skill: 'Probability and conditional probability ',
    difficulty: 'Easy',
    question_type: 'multiple_choice',
    question_html: '<p>Roll <math><mfenced><mn>1</mn></mfenced></math></p>',
    choices: [
      { label: 'A', html: '<p>1/14</p>' },
      { label: 'B', html: '<p>2/14</p>' },
    ],
    correct_answer: 'A',
    accepted_answers: ['A'],
    explanation_html: '<p>Choice A is correct.</p>',
  });
  expect(q).toMatchObject({ id: 'eccbf957', domain: 'psda', difficulty: 1, format: 'mcq', answer: 'A' });
  expect(q.skill).toBe('Probability and conditional probability');
  expect(q.promptHtml).not.toContain('mfenced');
  expect(q.choices).toHaveLength(2);
});
