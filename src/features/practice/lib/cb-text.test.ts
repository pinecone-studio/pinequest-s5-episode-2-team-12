import { expect, test } from 'bun:test';
import { cbText } from './cb-text';

test('keeps fractions, powers and roots readable', () => {
  const html =
    '<p>If <math><mfrac><mn>3</mn><mn>4</mn></mfrac><mi>x</mi><mo>=</mo><msup><mi>y</mi><mn>2</mn></msup></math>, what is <math><msqrt><mn>5</mn></msqrt></math>?</p>';
  expect(cbText(html)).toBe('If 3/4x = y^2, what is sqrt(5)?');
});

test('groups longer parts; the spoken alttext is only a fallback for empty markup', () => {
  expect(cbText('<math><mfrac><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow><mn>2</mn></mfrac></math>')).toBe(
    '(x + 1)/2',
  );
  expect(cbText('<p>Solve <math alttext="x squared"><msup><mi>x</mi><mn>2</mn></msup></math>.</p>')).toBe(
    'Solve x^2.',
  );
  expect(cbText('<p>Solve <math alttext="x squared"></math>.</p>')).toBe('Solve x squared.');
});

test('real bank markup: roots with an index and powers of a group', () => {
  const html =
    '<math><mroot><mrow><mn>70</mn><mi>n</mi></mrow><mn>5</mn></mroot><msup><mfenced><mroot><mrow><mn>70</mn><mi>n</mi></mrow><mn>6</mn></mroot></mfenced><mn>2</mn></msup></math>';
  expect(cbText(html)).toBe('root5(70n)(root6(70n))^2');
});

test('paragraphs become lines; figures and entities are handled', () => {
  const html =
    '<p>A table:</p><table><tr><td>1</td><td>2</td></tr></table><svg><text>9</text></svg><p>5 &minus; 2 &amp; more</p>';
  expect(cbText(html)).toBe('A table:\n1 | 2 |\n5 − 2 & more');
});

test('fenced points', () => {
  expect(cbText('<math><mfenced><mn>2</mn><mn>5</mn></mfenced></math>')).toBe('(2, 5)');
});
