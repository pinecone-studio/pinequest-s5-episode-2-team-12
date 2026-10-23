'use client';
// Shared Desmos runtime for the pitch demo: loads the official Desmos API once, draws lessons step by step.
import { type RefObject, useEffect, useRef, useState } from 'react';
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
};
type DesmosGlobal = { GraphingCalculator: (el: HTMLElement, opts?: Record<string, unknown>) => Calc };
declare global {
  interface Window {
    Desmos?: DesmosGlobal;
  }
}

let loading: Promise<DesmosGlobal> | null = null;

/** Loads the Desmos script once, shared by every graph on the page (tries a second version if the first fails). */
function loadDesmos(): Promise<DesmosGlobal> {
  if (window.Desmos) return Promise.resolve(window.Desmos);
  if (!loading) {
    loading = loadScript().catch((e) => {
      loading = null;
      throw e;
    });
  }
  return loading;
}

function loadScript(): Promise<DesmosGlobal> {
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

export type GraphState = 'loading' | 'ready' | 'failed';

/** Creates a Desmos calculator inside `box` once the script loads; destroys it on unmount. */
export function useDesmosCalc(box: RefObject<HTMLDivElement | null>, options: Record<string, unknown> = {}) {
  const calc = useRef<Calc | null>(null);
  const [graph, setGraph] = useState<GraphState>('loading');
  const opts = useRef(options);
  useEffect(() => {
    let alive = true;
    loadDesmos()
      .then((D) => {
        if (!alive || !box.current) return;
        calc.current = D.GraphingCalculator(box.current, { settingsMenu: false, ...opts.current });
        setGraph('ready');
      })
      .catch(() => alive && setGraph('failed'));
    return () => {
      alive = false;
      calc.current?.destroy();
      calc.current = null;
    };
  }, [box]);
  return { calc, graph };
}
