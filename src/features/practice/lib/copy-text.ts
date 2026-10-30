// Plain text for copying College Board questions from the page (cb-text.ts is the string version for Суу).
// The browser copies MathML symbol by symbol, one per
// line, and drops fractions and exponents (x² becomes "x2"); this writes math on one line instead:
// "w + 7 = 357", "(x + 1)/2", "x^2", "sqrt(x)". Figures become "[зураг]", tables "a | b" rows.

const BLOCKS = new Set([
  'p',
  'div',
  'li',
  'ul',
  'ol',
  'figure',
  'figcaption',
  'h1',
  'h2',
  'h3',
  'h4',
  'table',
]);
const SKIP = new Set(['style', 'script', 'annotation', 'annotation-xml', 'mphantom']);
const MATH_TAGS =
  /^m(i|n|o|text|s|space|frac|sup|sub|subsup|sqrt|root|over|under|underover|row|style|padded|enclose)$/;
const SPACED_OPS = new Set(['=', '+', '−', '-', '<', '>', '≤', '≥', '≠', '×', '÷', '±', '≈']);

/** Parenthesise anything longer than one number or name, so "a+b" over "2" stays "(a + b)/2". */
function wrap(s: string): string {
  const t = s.trim();
  if (/^[\p{L}\d.,]+$/u.test(t)) return t;
  if (/^\(.*\)$/.test(t) && balanced(t.slice(1, -1))) return t;
  return `(${t})`;
}

function balanced(s: string): boolean {
  let depth = 0;
  for (const c of s) {
    if (c === '(') depth++;
    else if (c === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

function children(el: Element): string[] {
  return [...el.childNodes].map(walk).filter((s) => s !== '');
}

/** MathML: element children only; whitespace text between the tags is indentation, not content. */
function mathChildren(el: Element): string[] {
  return [...el.children].map(walk).filter((s) => s !== '');
}

/** An operator gets spaces, except a leading minus ("−3", "x = −3"). */
function operator(el: Element): string {
  const t = (el.textContent ?? '').trim();
  if (!SPACED_OPS.has(t)) return t === ',' ? ', ' : t;
  const prev = el.previousElementSibling;
  const unary = (t === '−' || t === '-') && (!prev || prev.localName === 'mo');
  return unary ? t : ` ${t} `;
}

function math(el: Element): string {
  const kids = [...el.children];
  const at = (i: number) => (kids[i] ? walk(kids[i]) : '');
  switch (el.localName) {
    case 'mi':
    case 'mn':
    case 'ms':
      return (el.textContent ?? '').trim();
    case 'mtext':
      return (el.textContent ?? '').replace(/\s+/g, ' ');
    case 'mo':
      return operator(el);
    case 'mspace':
      return ' ';
    case 'mfrac': {
      // "9/2 v^2" would read as 9/(2v^2): bracket a fraction that something multiplies
      const frac = `${wrap(at(0))}/${wrap(at(1))}`;
      const next = el.nextElementSibling;
      return next && next.localName !== 'mo' ? `(${frac})` : frac;
    }
    case 'msup':
      return `${wrap(at(0))}^${wrap(at(1))}`;
    case 'msub':
      return `${at(0)}_${wrap(at(1))}`;
    case 'msubsup':
      return `${at(0)}_${wrap(at(1))}^${wrap(at(2))}`;
    case 'msqrt':
      return `sqrt(${mathChildren(el).join('')})`;
    case 'mroot':
      return `root${wrap(at(1))}(${at(0)})`;
    case 'mover': {
      // overline / arrow over a segment name: keep the name, the line can't be typed
      const accent = at(1).trim();
      return accent === '‾' || accent === '¯' || accent === '_' ? at(0) : `${at(0)}${accent}`;
    }
    case 'munder':
    case 'munderover':
      return at(0);
    case 'semantics':
      return at(0);
    default:
      return mathChildren(el).join('');
  }
}

const ORDINALS: Record<string, number> = {
  half: 2,
  halves: 2,
  third: 3,
  thirds: 3,
  fourth: 4,
  fourths: 4,
  quarter: 4,
  quarters: 4,
  fifth: 5,
  fifths: 5,
  sixth: 6,
  sixths: 6,
  seventh: 7,
  sevenths: 7,
  eighth: 8,
  eighths: 8,
  ninth: 9,
  ninths: 9,
  tenth: 10,
  tenths: 10,
};
const SMALL: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
};
const ORDINAL = Object.keys(ORDINALS).join('|');

/** Older questions draw math as images; their alt text spells it out ("f of x equals 4 thirds"). */
function spokenMath(alt: string): string {
  return alt
    .replace(/,\s*(plus|minus|times|equals),?\s*/g, ' $1 ')
    .replace(/\s+comma\s+/g, ', ')
    .replace(/,?\s*open parenthesis,?\s*/g, ' (')
    .replace(/,?\s*close parenthesis,?/g, ')')
    .replace(
      /the fraction with numerator (.+?),? and denominator,? (.+?)(?:,?\s*end fraction|(?=,)|$)/gi,
      (_, n, d) => `${wrap(n)}/${wrap(d)}`,
    )
    .replace(/the square root of ([\w.^]+)/gi, 'sqrt($1)')
    .replace(/the cube root of ([\w.^]+)/gi, 'cbrt($1)')
    .replace(new RegExp(`\\b(\\d+|${Object.keys(SMALL).join('|')})\\s+(${ORDINAL})\\b`, 'g'), (_, n, o) => {
      const num = SMALL[n] ?? n;
      return `${num}/${ORDINALS[o]}`;
    })
    .replace(/\bsquared\b/g, '^2')
    .replace(/\bcubed\b/g, '^3')
    .replace(/\s+to the power of\s+/g, '^')
    .replace(/\b([a-zA-Z]) of ?(?=\()/g, '$1')
    .replace(/\b([a-zA-Z]) of ([a-zA-Z0-9]+)\b/g, '$1($2)')
    .replace(/\bnegative\s+/g, '−')
    .replace(/,?\s+equals,?\s+/g, ' = ')
    .replace(/\s+plus\s+/g, ' + ')
    .replace(/\s+minus\s+/g, ' − ')
    .replace(/\s+times,?\s+/g, ' × ')
    .replace(/(\d) ([a-z])\b/g, '$1$2')
    .replace(/\s+\^/g, '^')
    .replace(/\s+/g, ' ')
    .trim();
}

function walk(node: Node): string {
  if (node.nodeType === 3) return (node.textContent ?? '').replace(/\s+/g, ' ');
  if (node.nodeType !== 1 && node.nodeType !== 11) return '';
  if (node.nodeType === 11) return [...node.childNodes].map(walk).join('');
  const el = node as Element;
  const name = el.localName;
  if (SKIP.has(name)) return '';
  if (el.getAttribute('aria-hidden') === 'true') return '';
  if (name === 'math') {
    const text = mathChildren(el).join('').replace(/\s+/g, ' ').trim();
    return text || (el.getAttribute('alttext') ?? '');
  }
  // a partial selection inside a formula has no <math> parent
  if (MATH_TAGS.test(name)) return math(el);
  if (name === 'br') return '\n';
  if (name === 'img' && el.getAttribute('role') === 'math' && el.getAttribute('alt'))
    return spokenMath(el.getAttribute('alt') ?? '');
  if (name === 'img' || name === 'svg') {
    const alt = el.getAttribute('alt') || el.getAttribute('aria-label');
    return alt ? ` [зураг: ${alt}] ` : ' [зураг] ';
  }
  if (name === 'td' || name === 'th') return `${children(el).join('').trim()} | `;
  if (name === 'tr') return `${children(el).join('').replace(/ \| $/, '')}\n`;
  const inner = children(el).join('');
  return BLOCKS.has(name) ? `\n${inner}\n` : inner;
}

/** Tidy line breaks and spaces after walking. */
function tidy(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Copyable text for a DOM node or fragment (a selection's contents, a parsed question). */
export function copyText(node: Node): string {
  return tidy(walk(node));
}

/** Copyable text for a whole question: prompt, then "A) …" choice lines. */
export function questionCopyText(promptHtml: string, choices: { label: string; html: string }[]): string {
  const parse = (html: string) => copyText(new DOMParser().parseFromString(html, 'text/html').body);
  const lines = choices.map((c) => `${c.label}) ${parse(c.html).replace(/\n+/g, ' ')}`);
  return [parse(promptHtml), lines.join('\n')].filter(Boolean).join('\n\n');
}
