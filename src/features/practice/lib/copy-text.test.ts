import { expect, test } from 'bun:test';
import { rewriteMfenced } from './cb-html';
import { copyText, questionCopyText } from './copy-text';

const html = (s: string) => new DOMParser().parseFromString(s, 'text/html').body;

test('MathML copies as one line instead of one symbol per line', () => {
  const prompt =
    '<p style="text-align: center;"><math alttext="w plus 7 equals 357"><mrow>\n\t<mrow>\n\t\t<mi>w</mi>\n\t\t<mo>+</mo>\n\t\t<mn>7</mn>\n\t</mrow>\n\t<mo>=</mo>\n\t<mn>357</mn>\n</mrow>\n</math></p>\n<p>What value of <math alttext="w"><mi>w</mi>\n</math> is the solution to the given equation?</p>';
  expect(copyText(html(prompt))).toBe(
    'w + 7 = 357\n\nWhat value of w is the solution to the given equation?',
  );
});

test('fractions, powers, roots, a leading minus and fences keep their structure', () => {
  const m = (inner: string) => copyText(html(`<math>${inner}</math>`));
  expect(m('<mfrac><mrow><mi>x</mi><mo>+</mo><mn>1</mn></mrow><mn>2</mn></mfrac>')).toBe('(x + 1)/2');
  expect(m('<msup><mi>x</mi><mn>2</mn></msup><mo>−</mo><mn>9</mn>')).toBe('x^2 − 9');
  expect(m('<msqrt><mn>3</mn><mi>x</mi></msqrt>')).toBe('sqrt(3x)');
  expect(m('<mi>y</mi><mo>=</mo><mo>−</mo><mn>3</mn>')).toBe('y = −3');
  expect(m(rewriteMfenced('<mfenced><mn>2</mn><mn>5</mn></mfenced>'))).toBe('(2, 5)');
});

test('the whole question copies with lettered choices; figures and tables stay readable', () => {
  const text = questionCopyText(
    '<p>Points:</p><table><tr><th>x</th><th>y</th></tr><tr><td>1</td><td>4</td></tr></table><svg></svg>',
    [
      { label: 'A', html: '<p><math><mn>51</mn></math></p>' },
      { label: 'B', html: '<p><math><mfrac><mn>1</mn><mn>3</mn></mfrac></math></p>' },
    ],
  );
  expect(text).toBe('Points:\n\nx | y\n1 | 4\n\n[зураг]\n\nA) 51\nB) 1/3');
});

test('indentation inside MathML, multiplied fractions and image-drawn math stay readable', () => {
  expect(copyText(html('<math><mrow>\n\t<mn>7</mn>\n\t<mi>x</mi>\n</mrow></math>'))).toBe('7x');
  expect(
    copyText(html('<math><mfrac><mn>9</mn><mn>2</mn></mfrac><msup><mi>v</mi><mn>2</mn></msup></math>')),
  ).toBe('(9/2)v^2');
  expect(copyText(html('<p>Line <img role="math" alt="x equals negative 2"> is vertical.</p>'))).toBe(
    'Line x = −2 is vertical.',
  );
});

test('spoken alt text of image-drawn math becomes symbols', () => {
  const img = (alt: string) => copyText(html(`<img role="math" alt="${alt}">`));
  expect(img('f of open parenthesis, 3 x, close parenthesis, = x − 6')).toBe('f(3x) = x − 6');
  expect(img('f of x equals, the fraction with numerator 2 x − 1, and denominator 3')).toBe(
    'f(x) = (2x − 1)/3',
  );
  expect(img('negative one half')).toBe('−1/2');
  expect(img('4 thirds')).toBe('4/3');
  expect(img('5 times, open parenthesis, x + 3, close parenthesis')).toBe('5 × (x + 3)');
  expect(img('x squared plus 1')).toBe('x^2 + 1');
});

test('longer spoken forms: end fraction, roots and commas around operators', () => {
  const img = (alt: string) => copyText(html(`<img role="math" alt="${alt}">`));
  expect(img('the fraction with numerator x, plus, 160, and denominator, 2 c , end fraction')).toBe(
    '(x + 160)/(2c)',
  );
  expect(img('18 + 6, times the square root of 3')).toBe('18 + 6 × sqrt(3)');
});
