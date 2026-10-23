import { expect, test } from 'bun:test';
import mn from '@/features/tutor/messages/mn.json';
import { normalize, scriptedReply } from './scripted';

test('normalize ignores case, spaces, markdown and punctuation', () => {
  expect(normalize('**3x + 5 = 20?**')).toBe('3x+5=20');
});

test('every chat starter gets a hand-written answer', () => {
  for (const s of Object.values(mn.starters)) expect(scriptedReply(s)?.text.length).toBeGreaterThan(50);
});

test('pitch questions match even when typed differently', () => {
  expect(scriptedReply('If 3x + 5 = 20, what is the value of x?')?.lesson).toBe('intersection');
  expect(scriptedReply('3x+5=20 бол x хэд вэ')?.lesson).toBe('intersection');
  expect(scriptedReply('y = kx + 3 ба y = 2x − 1 шийдгүй байх k?')?.lesson).toBe('slider');
  expect(scriptedReply('(1, 2), (3, 8), (5, 14) цэгийг дайрах шулууны налалт')?.lesson).toBe('regression');
});

test('every Desmos lesson has a question in the chat that opens it', () => {
  expect(
    scriptedReply('The data set 4, 7, 7, 9, 13 is given. What is the mean of the data set?')?.lesson,
  ).toBe('statistics');
  expect(
    scriptedReply("A ball's height is h(t) = −5t² + 20t + 1 meters. What is the maximum height of the ball?")
      ?.lesson,
  ).toBe('maxmin');
  expect(scriptedReply('Which point is a solution to the system y > 2x + 1 and y < −x + 5?')?.lesson).toBe(
    'inequality',
  );
  // the 'at least' starter must not be taken by the statistics or inequality answers
  expect(scriptedReply('«at least», «at most» гэж юу болохыг тайлбарлаач')?.lesson).toBeUndefined();
});

test('other questions are left to the model', () => {
  expect(scriptedReply('Пифагорын теорем гэж юу вэ?')).toBeNull();
});

test('math in answers is balanced so KaTeX can render it', () => {
  for (const s of [
    '3x+5=20',
    'kx+3',
    'регресс',
    'at least',
    'төлөвлөгөө',
    'ахиулах',
    'шугаман тэгшитгэл',
    'намайг шалгаач',
  ]) {
    const text = scriptedReply(s)?.text ?? '';
    expect(text.replace(/\\\$/g, '').split('$').length % 2).toBe(1);
  }
});

test('answer choices like (−1, 2) do not look like the regression points (1, 2)', () => {
  const q =
    'Which point is a solution to the system y > 2x + 1 and y < −x + 5? (A) (0, 0) (B) (1, 3) (C) (−1, 2) (D) (2, 4)';
  expect(scriptedReply(q)?.lesson).toBe('inequality');
  expect(scriptedReply('A line passes through (1, 2), (3, 8) and (5, 14). What is the slope?')?.lesson).toBe(
    'regression',
  );
});
