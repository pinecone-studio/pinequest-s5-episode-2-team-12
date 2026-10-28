// Client-only. The official Desmos API (loaded from desmos.com) and how a lesson or a question's hand-written
// rows are drawn on it. Shared by Desmos Академи (/desmos/ai) and the side panel next to a problem.
import type { DesmosAiLesson } from './desmos-lessons';

// Demo API key from the Desmos docs (development only). A product release needs our own key.
const DESMOS_KEY = 'dcb31709b452b1cf9dc26972add0fda6';
const DESMOS_SRC = [
  `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${DESMOS_KEY}`,
  `https://www.desmos.com/api/v1.7/calculator.js?apiKey=${DESMOS_KEY}`,
];
const COLORS: Record<string, string> = {
  blue: '#2d70b3',
  red: '#c74440',
  green: '#388c46',
  purple: '#6042a6',
  orange: '#fa7e19',
  black: '#000000',
};

export type Calc = {
  setBlank: () => void;
  setExpression: (e: Record<string, unknown>) => void;
  setMathBounds: (b: { left: number; right: number; bottom: number; top: number }) => void;
  destroy: () => void;
  resize?: () => void;
};
export type DesmosGlobal = { GraphingCalculator: (el: HTMLElement, opts?: Record<string, unknown>) => Calc };
declare global {
  interface Window {
    Desmos?: DesmosGlobal;
  }
}

/** Loads the Desmos script once (tries a second version if the first fails). */
export function loadDesmos(): Promise<DesmosGlobal> {
  if (window.Desmos) return Promise.resolve(window.Desmos);
  const tryLoad = (i: number): Promise<DesmosGlobal> =>
    new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = DESMOS_SRC[i];
      s.async = true;
      s.onload = () => (window.Desmos ? resolve(window.Desmos) : reject(new Error('no Desmos')));
      s.onerror = () => reject(new Error('load failed'));
      document.head.appendChild(s);
    }).catch((e) =>
      i + 1 < DESMOS_SRC.length ? tryLoad(i + 1) : Promise.reject(e),
    ) as Promise<DesmosGlobal>;
  return tryLoad(0);
}

/** Draws steps 0..upTo of a lesson. Re-assigning a slider (k=2 after k=1) moves the same slider. */
export function drawLesson(calc: Calc, lesson: DesmosAiLesson, upTo: number) {
  calc.setBlank();
  const vars: Record<string, string> = {};
  let n = 0;
  let bounds: DesmosAiLesson['steps'][number]['bounds'];
  for (const step of lesson.steps.slice(0, upTo + 1)) {
    if (step.bounds) bounds = step.bounds;
    for (const it of step.desmos) {
      if (it.type === 'table') {
        calc.setExpression({ id: `t${n++}`, type: 'table', columns: it.columns });
        continue;
      }
      const e: Record<string, unknown> = { latex: it.latex };
      if (it.color) e.color = COLORS[it.color] ?? it.color;
      if (it.label) {
        e.label = it.label;
        e.showLabel = it.showLabel !== false;
      }
      if (it.sliderBounds) e.sliderBounds = it.sliderBounds;
      if (it.lineStyle) e.lineStyle = it.lineStyle;
      const v = /^([a-zA-Z](?:_\{?\w+\}?)?)=-?[\d.]+$/.exec(it.latex ?? '');
      if (v && vars[v[1]]) e.id = vars[v[1]];
      else {
        e.id = `e${n++}`;
        if (v) vars[v[1]] = e.id as string;
      }
      calc.setExpression(e);
    }
  }
  if (bounds) calc.setMathBounds(bounds);
}

/**
 * Draws a question's hand-written Desmos rows (Question.desmos.rows): plain expressions such as "y=3x+5",
 * or "TABLE:1,3;2,5" for a table of points (a trailing ";R" adds a linear regression).
 */
export function drawRows(calc: Calc, rows: string[]) {
  calc.setBlank();
  rows.forEach((row, i) => {
    const table = /^TABLE:(.+?)(;R)?$/.exec(row.trim());
    if (!table) {
      calc.setExpression({ id: `r${i}`, latex: row.trim() });
      return;
    }
    const points = table[1]
      .split(';')
      .map((p) => p.split(',').map((s) => s.trim()))
      .filter((p) => p.length === 2);
    calc.setExpression({
      id: `r${i}`,
      type: 'table',
      columns: [
        { latex: 'x_1', values: points.map((p) => p[0]) },
        { latex: 'y_1', values: points.map((p) => p[1]) },
      ],
    });
    if (table[2]) calc.setExpression({ id: `r${i}reg`, latex: 'y_1\\sim mx_1+b' });
  });
}
