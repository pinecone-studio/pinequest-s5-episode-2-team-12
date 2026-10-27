import { describe, expect, test } from 'bun:test';
import {
  prepareCbHtml,
  rewriteMenclose,
  rewriteMfenced,
  scopeIds,
  scopeStyles,
  stripUnsafe,
} from './cb-html';

describe('rewriteMfenced', () => {
  test('turns a default mfenced into parentheses', () => {
    expect(rewriteMfenced('<mfenced><mrow><mi>x</mi><mo>-</mo><mn>8</mn></mrow></mfenced>')).toBe(
      '<mrow><mo fence="true">(</mo><mrow><mi>x</mi><mo>-</mo><mn>8</mn></mrow><mo fence="true">)</mo></mrow>',
    );
  });

  test('keeps custom fences such as absolute value bars', () => {
    expect(rewriteMfenced('<mfenced open="|" close="|"><mi>x</mi></mfenced>')).toBe(
      '<mrow><mo fence="true">|</mo><mi>x</mi><mo fence="true">|</mo></mrow>',
    );
  });

  test('adds commas between several children (an ordered pair)', () => {
    expect(rewriteMfenced('<mfenced><mn>3</mn><mn>4</mn></mfenced>')).toBe(
      '<mrow><mo fence="true">(</mo><mn>3</mn><mo>,</mo><mn>4</mn><mo fence="true">)</mo></mrow>',
    );
  });

  test('handles nested mfenced', () => {
    const out = rewriteMfenced('<mfenced><mfenced><mi>a</mi></mfenced></mfenced>');
    expect(out).not.toContain('mfenced');
    expect(out.match(/fence="true">\(/g)).toHaveLength(2);
  });
});

test('rewriteMenclose draws an overline', () => {
  expect(rewriteMenclose('<menclose notation="top"><mi>AB</mi></menclose>')).toBe(
    '<mover accent="true"><mrow><mi>AB</mi></mrow><mo>‾</mo></mover>',
  );
});

test('stripUnsafe removes scripts, handlers and javascript urls', () => {
  const out = stripUnsafe('<p onclick="x()">a</p><script>alert(1)</script><a href="javascript:x">b</a>');
  expect(out).toBe('<p>a</p><a href="#">b</a>');
});

test('scopeIds prefixes ids and the references to them', () => {
  const out = scopeIds(
    '<g id="glyph0-1"/><use xlink:href="#glyph0-1"/><rect clip-path="url(#glyph0-1)"/>',
    'q1',
  );
  expect(out).toBe(
    '<g id="q1-glyph0-1"/><use xlink:href="#q1-glyph0-1"/><rect clip-path="url(#q1-glyph0-1)"/>',
  );
});

test('scopeStyles keeps figure styles inside their own question', () => {
  expect(
    scopeStyles('<style>*{stroke-linecap:butt;} .small, .heavy { font: bold 3px a; }</style>', 'q1'),
  ).toBe(
    '<style>[data-cb="q1"] *{stroke-linecap:butt;}[data-cb="q1"] .small, [data-cb="q1"] .heavy{ font: bold 3px a; }</style>',
  );
});

test('prepareCbHtml returns an empty string for empty input', () => {
  expect(prepareCbHtml('', 'q1')).toBe('');
});
