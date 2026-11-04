import { expect, test } from 'bun:test';
import { mapOfficialRow } from './official';
import { officialSolveIssue } from './topic-bank';

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
