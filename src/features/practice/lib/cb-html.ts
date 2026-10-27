// Prepares College Board question-bank HTML (MathML, inline SVG figures, tables) for display.
// The bank rows are written only by the service role, but we still strip anything executable.

/** Split MathML children at the top level, so `<mi>a</mi><mn>2</mn>` → ['<mi>a</mi>', '<mn>2</mn>']. */
function topLevelChildren(inner: string): string[] {
  const parts: string[] = [];
  const tag = /<(\/?)([a-zA-Z][\w:-]*)[^>]*?(\/?)>/g;
  let depth = 0;
  let start = -1;
  let m: RegExpExecArray | null = tag.exec(inner);
  while (m) {
    const [, closing, , selfClosing] = m;
    if (!closing && depth === 0) start = m.index;
    if (closing) depth -= 1;
    else if (!selfClosing) depth += 1;
    if (depth === 0 && start >= 0) {
      parts.push(inner.slice(start, m.index + m[0].length));
      start = -1;
    }
    m = tag.exec(inner);
  }
  return parts;
}

function attr(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`));
  return m?.[1];
}

/**
 * `<mfenced>` is not part of MathML Core, so Chrome and Safari draw no brackets for it.
 * Rewrite it (innermost first) as an `<mrow>` with explicit `<mo>` fences and separators.
 */
export function rewriteMfenced(html: string): string {
  const innermost = /<mfenced([^>]*)>((?:(?!<mfenced)[\s\S])*?)<\/mfenced>/;
  let out = html;
  let m = innermost.exec(out);
  while (m) {
    const [whole, attrs, inner] = m;
    const open = attr(attrs, 'open') ?? '(';
    const close = attr(attrs, 'close') ?? ')';
    const seps = (attr(attrs, 'separators') ?? ',').replace(/\s+/g, '');
    const kids = topLevelChildren(inner);
    const body = kids
      .map((kid, i) =>
        i < kids.length - 1 && seps ? `${kid}<mo>${seps[Math.min(i, seps.length - 1)]}</mo>` : kid,
      )
      .join('');
    const fence = (s: string) => (s ? `<mo fence="true">${s}</mo>` : '');
    out = out.replace(whole, `<mrow>${fence(open)}${body || inner}${fence(close)}</mrow>`);
    m = innermost.exec(out);
  }
  return out;
}

/** `<menclose notation="top">` (an overline, e.g. a line segment) is also outside MathML Core. */
export function rewriteMenclose(html: string): string {
  return html.replace(
    /<menclose\s+notation="top"\s*>([\s\S]*?)<\/menclose>/g,
    '<mover accent="true"><mrow>$1</mrow><mo>‾</mo></mover>',
  );
}

/** Remove scripts, inline event handlers and javascript: URLs. */
export function stripUnsafe(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(iframe|object|embed|link|meta)\b[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"');
}

/**
 * SVG figures reuse ids such as "glyph0-1"; with many questions on one page a `<use href="#glyph0-1">`
 * would pick up another question's glyph. Give every id in this snippet a unique prefix.
 */
export function scopeIds(html: string, scope: string): string {
  const ids = new Set<string>();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  if (ids.size === 0) return html;
  let out = html.replace(/\sid="([^"]+)"/g, (_, id: string) => ` id="${scope}-${id}"`);
  out = out.replace(/((?:xlink:)?href)="#([^"]+)"/g, (whole, a: string, id: string) =>
    ids.has(id) ? `${a}="#${scope}-${id}"` : whole,
  );
  out = out.replace(/url\(\s*#([^)\s]+)\s*\)/g, (whole, id: string) =>
    ids.has(id) ? `url(#${scope}-${id})` : whole,
  );
  return out;
}

/** Figure `<style>` blocks (e.g. `*{stroke-linecap:butt}`) would otherwise restyle the whole app. */
export function scopeStyles(html: string, scope: string): string {
  const prefix = `[data-cb="${scope}"]`;
  return html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/gi, (_, attrs: string, css: string) => {
    const scoped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/([^{}]+)\{/g, (__, selectors: string) => {
      const list = selectors
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (s.startsWith('@') ? s : `${prefix} ${s}`));
      return `${list.join(', ')}{`;
    });
    return `<style${attrs}>${scoped}</style>`;
  });
}

/** Everything a bank snippet needs before `dangerouslySetInnerHTML`. `scope` must be unique per snippet. */
export function prepareCbHtml(html: string, scope: string): string {
  if (!html) return '';
  return scopeStyles(scopeIds(rewriteMenclose(rewriteMfenced(stripUnsafe(html))), scope), scope);
}
