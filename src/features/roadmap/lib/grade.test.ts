import { expect, test } from 'bun:test';
import type { Question } from '@/types';
import { correctAnswerText, isCorrect, isMcq } from './grade';

const mcq: Question = {
  id: 'q1',
  domain: 'alg',
  skill: 's',
  difficulty: 1,
  prompt: 'p',
  choices: ['$1$', '$2$', '$3$', '$4$'],
  answer: 2,
  explain: '',
  hint: '',
};
const spr: Question = { ...mcq, id: 'q2', choices: undefined, answer: ['3/4', '.75', '0.75'], format: 'spr' };

test('mcq grading by index', () => {
  expect(isMcq(mcq)).toBe(true);
  expect(isCorrect(mcq, '2')).toBe(true);
  expect(isCorrect(mcq, '1')).toBe(false);
  expect(isCorrect(mcq, '')).toBe(false);
  expect(isCorrect(mcq, '2; drop table')).toBe(false);
});

test('spr accepts equivalent fraction and decimal forms', () => {
  expect(isMcq(spr)).toBe(false);
  expect(isCorrect(spr, '3/4')).toBe(true);
  expect(isCorrect(spr, '6/8')).toBe(true);
  expect(isCorrect(spr, '0.75')).toBe(true);
  expect(isCorrect(spr, '0.7')).toBe(false);
});

test('correct answer text', () => {
  expect(correctAnswerText(mcq)).toBe('C) $3$');
  expect(correctAnswerText(spr)).toBe('3/4');
});
