// Suu v2 · reads a student's planner note ("Мягмар гарагт завгүй. Бямба гарагт 3 цаг гаргаж чадна.") into the
// rules the planner follows: busy days (0 minutes) and days with a set number of minutes. It is the inverse of
// randomNote() in planner.ts (a test checks thousands of generated notes). The app uses it to check Suu's plan
// and to build the rule plan when Suu is off. No runtime imports outside ai/v2 (runs in Colab).
import type { NoteRules } from './planner';
import { DAYS, type Day } from './skills';

const DAY_WORDS: [Day, RegExp][] = [
  ['Да', /даваа/i],
  ['Мя', /мягмар/i],
  ['Лх', /лхагва/i],
  ['Пү', /пүрэв/i],
  ['Ба', /баасан/i],
  ['Бя', /бямба/i],
  ['Ня', /ням/i],
];

/** "Can't study / busy / rest" in the ways students write it. */
const BUSY =
  /завгүй|дугуйлан|шалгалттай|ажилтай|боломжгүй|чөлөөгүй|амар(?:на|маар|ах|даг)|хичээллэхгүй|чадахгүй|үгүй/i;
const HOURS = /(\d+(?:[.,]\d+)?)\s*цаг/i;
const MINUTES = /(\d+)\s*мин/i;

/** Busy days and set minutes from the note. Sentences without a weekday are ignored. */
export function parseNote(note: string | undefined): NoteRules {
  const rules: NoteRules = { busy: [], set: {} };
  if (!note) return rules;
  // a dot ends a sentence, except inside a number (2.5 цаг)
  for (const sentence of note.split(/(?<!\d)\.|\.(?!\d)|[!?;\n]+/)) {
    const days = DAY_WORDS.filter(([, re]) => re.test(sentence)).map(([d]) => d);
    if (!days.length) continue;
    const h = HOURS.exec(sentence);
    const m = MINUTES.exec(sentence);
    const minutes = h ? Math.round(Number(h[1].replace(',', '.')) * 60) : m ? Number(m[1]) : null;
    if (minutes !== null && minutes > 0) for (const d of days) rules.set[d] = minutes;
    else if (BUSY.test(sentence)) rules.busy.push(...days);
  }
  rules.busy = DAYS.filter((d) => rules.busy.includes(d));
  for (const d of rules.busy) delete rules.set[d];
  return rules;
}
