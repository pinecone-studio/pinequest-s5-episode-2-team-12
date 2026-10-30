// College Board HTML (MathML, tables, figures) → plain text for Суу. Fractions, powers and roots keep their
// structure ("3/4", "x^2", "sqrt(5)") so the model reads the math, not a run of digits. Pure: no DOM needed.

type Node = { name: string; attrs: Record<string, string>; kids: (Node | string)[] };

const VOID = new Set([
  'img',
  'br',
  'hr',
  'input',
  'meta',
  'link',
  'col',
  'source',
  'mspace',
  'none',
  'mprescripts',
]);
const SKIP = new Set(['svg', 'style', 'script', 'annotation', 'annotation-xml']);
const BLOCK = new Set([
  'p',
  'div',
  'li',
  'tr',
  'table',
  'figure',
  'figcaption',
  'ul',
  'ol',
  'h1',
  'h2',
  'h3',
  'h4',
]);

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  minus: '−',
  times: '×',
  divide: '÷',
  le: '≤',
  ge: '≥',
  ne: '≠',
  pi: 'π',
  deg: '°',
  middot: '·',
  plusmn: '±',
  infin: '∞',
  theta: 'θ',
  ang: '∠',
  perp: '⊥',
  sdot: '·',
  hellip: '…',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  InvisibleTimes: '',
  ApplyFunction: '',
};

function decode(s: string): string {
  return s.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED[e] ?? m;
  });
}

function parse(html: string): Node {
  const root: Node = { name: '#root', attrs: {}, kids: [] };
  const stack = [root];
  const re =
    /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)|</g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const [whole, close, rawName, rawAttrs, selfClose, text] = m;
    const top = stack[stack.length - 1];
    if (text !== undefined) {
      top.kids.push(decode(text));
      continue;
    }
    if (!rawName) {
      if (whole === '<') top.kids.push('<');
      continue;
    }
    const name = rawName.toLowerCase().replace(/^m:/, '');
    if (close) {
      const at = stack.map((n) => n.name).lastIndexOf(name);
      if (at > 0) stack.length = at;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of (rawAttrs ?? '').matchAll(/([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g))
      attrs[a[1].toLowerCase()] = decode(a[3] ?? a[4] ?? a[5] ?? '');
    const node: Node = { name, attrs, kids: [] };
    top.kids.push(node);
    if (!selfClose && !VOID.has(name)) stack.push(node);
  }
  return root;
}

/** Wrap a part of a fraction or power in parentheses unless it is a single number or letter. */
const group = (s: string) => (/^[\w.]+$|^\(.*\)$/.test(s) ? s : `(${s})`);

function text(n: Node | string): string {
  if (typeof n === 'string') return n;
  if (SKIP.has(n.name)) return '';
  const kids = n.kids.filter((k) => typeof k !== 'string' || k.trim() !== '' || !n.name.startsWith('m'));
  const part = (i: number) => (kids[i] === undefined ? '' : text(kids[i]).trim());
  const all = () => kids.map(text).join('');
  switch (n.name) {
    case 'math': {
      // alttext is the spoken form ("StartFraction a Over b EndFraction"): only when the markup is empty
      const own = all().trim();
      return ` ${own || n.attrs.alttext || ''} `;
    }
    case 'mfrac':
      return `${group(part(0))}/${group(part(1))}`;
    case 'msup':
      return `${part(0)}^${group(part(1))}`;
    case 'msub':
      return `${part(0)}_${group(part(1))}`;
    case 'msubsup':
      return `${part(0)}_${group(part(1))}^${group(part(2))}`;
    case 'msqrt':
      return `sqrt(${all().trim()})`;
    case 'mroot':
      return `root${group(part(1))}(${part(0)})`;
    case 'mfenced': {
      const open = n.attrs.open ?? '(',
        close = n.attrs.close ?? ')';
      const sep = n.attrs.separators ?? ',';
      return `${open}${kids.map((k) => text(k).trim()).join(`${sep[0] ?? ''} `)}${close}`;
    }
    case 'mo': {
      const o = all().trim();
      return /^[=<>≤≥≠+−\-×÷±·]$/.test(o) ? ` ${o} ` : o;
    }
    case 'img':
      return n.attrs.alt ? ` [${n.attrs.alt}] ` : '';
    case 'br':
      return '\n';
    case 'td':
    case 'th':
      return ` ${all().trim()} |`;
    default:
      return BLOCK.has(n.name) ? `\n${all()}\n` : all();
  }
}

/** Plain text of a College Board snippet: one line per paragraph, single spaces. */
export function cbText(html: string): string {
  return text(parse(html))
    .split('\n')
    .map((l) =>
      l
        .replace(/[ \t\u00a0]+/g, ' ')
        .replace(/\s+([,.;:?!)])/g, '$1')
        .replace(/\(\s+/g, '(')
        .trim(),
    )
    .filter(Boolean)
    .join('\n');
}
