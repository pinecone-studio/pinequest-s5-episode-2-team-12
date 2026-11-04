// SAT Math · hard (difficulty 3) templates — the topics students miss most on the Digital SAT:
// constants that make a system have no / infinitely many solutions, one-solution quadratics, circles in general form,
// line–parabola intersections, compound and reverse percent, cofunction trig, radians, outliers, |x| inequalities,
// shifted parabolas. Answers are computed in code and re-solved from the prompt text in hard.test.ts.
import { coef, frac, gcd, int, lin, mcq, nonZero, pick, type Rng, type Template, term } from './shared';

/** ax^2 + bx + c as TeX, dropping zero terms (a is never 0 here). */
export function poly2(a: number, b: number, c: number): string {
  let s = coef(a, 'x^2');
  if (b) s += ` ${term(b)}`.replace(/(\d+)$/, '$1x').replace(/ 1x$/, ' x');
  if (c) s += ` ${term(c)}`;
  return s;
}

/** "+ 3y" style term with the variable, skipping a 1 coefficient. */
const vterm = (n: number, v: string) => (Math.abs(n) === 1 ? `${n < 0 ? '-' : '+'} ${v}` : `${term(n)}${v}`);
/** Desmos row text: TeX spacing removed. */
const row = (s: string) => s.replace(/ /g, '');
/** The ordinary values in random order, then the outlier somewhere among them. */
function shuffleKeepLast(r: Rng, xs: number[], out: number): number[] {
  const a = [...xs];
  a.splice(int(r, 0, a.length), 0, out);
  return a;
}
const signed = (r: Rng, lo: number, hi: number) => int(r, lo, hi) * (r() < 0.5 ? -1 : 1);

const TRIPLES: readonly [number, number, number][] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
  [9, 40, 41],
  [12, 35, 37],
  [11, 60, 61],
  [28, 45, 53],
  [33, 56, 65],
  [16, 63, 65],
];

export const HARD: Template[] = [
  {
    key: 'sys-no-sol',
    domain: 'alg',
    skill: 'Systems of linear equations',
    difficulty: 3,
    make: (r) => {
      const a = int(r, 2, 6);
      const b = signed(r, 2, 5);
      const c = int(r, 1, 12);
      const m = int(r, 2, 4);
      const e = c * m + nonZero(r, -5, 5);
      const k = a * m;
      return {
        prompt: `$$${a}x ${vterm(b, 'y')} = ${c}$$ $$kx ${vterm(b * m, 'y')} = ${e}$$ In the system of equations above, $k$ is a constant. If the system has no solution, what is the value of $k$?`,
        answer: [String(k)],
        explain: `Шийдгүй систем = хоёр зэрэгцээ шулуун: $x$ ба $y$-ийн коэффициентууд ижил харьцаатай, харин сул гишүүн өөр харьцаатай. $y$-ийн коэффициент $${b} \\to ${b * m}$ буюу ${m} дахин өссөн. Тэгэхээр $k = ${a} \\cdot ${m} = ${k}$. Шалгах: $${c} \\cdot ${m} = ${c * m} \\ne ${e}$, тиймээс шулуунууд давхцахгүй.`,
        hint: 'Шийдгүй гэдэг нь хоёр шулуун зэрэгцээ (налалт ижил, огтлолцохгүй) гэсэн үг. $y$-ийн коэффициент хэд дахин өссөнийг ол.',
        desmos: {
          rows: [row(`${a}x ${vterm(b, 'y')}=${c}`), row(`kx ${vterm(b * m, 'y')}=${e}`), 'k=1'],
          tip: `$k$ гулсуурыг хөдөлгөж хоёр шулууныг зэрэгцээ болго — тэр үед $k = ${k}$.`,
        },
        mn: 'no solution = шийдгүй, constant = тогтмол тоо',
        vocab: ['system', 'constant', 'no solution'],
      };
    },
  },
  {
    key: 'sys-infinite',
    domain: 'alg',
    skill: 'Systems of linear equations',
    difficulty: 3,
    make: (r) => {
      const a = int(r, 2, 6);
      const b = signed(r, 2, 5);
      const c = int(r, 1, 12);
      const m = int(r, 2, 5);
      return {
        prompt: `$$${a}x ${vterm(b, 'y')} = ${c}$$ $$${a * m}x ${vterm(b * m, 'y')} = n$$ In the system of equations above, $n$ is a constant. If the system has infinitely many solutions, what is the value of $n$?`,
        answer: [String(c * m)],
        explain: `Хязгааргүй олон шийдтэй = хоёр тэгшитгэл нэг л шулуун. Хоёр дахь тэгшитгэлийн коэффициент бүр ${m} дахин их: $${a} \\to ${a * m}$, $${b} \\to ${b * m}$. Тэгэхээр $n = ${c} \\cdot ${m} = ${c * m}$.`,
        hint: 'Эхний тэгшитгэлийг хэдээр үржүүлбэл хоёр дахь тэгшитгэлийн $x$, $y$ коэффициент гарах вэ?',
        mn: 'infinitely many solutions = хязгааргүй олон шийд',
        vocab: ['infinitely many', 'solutions'],
      };
    },
  },
  {
    key: 'quad-one-sol',
    domain: 'adv',
    skill: 'Discriminant',
    difficulty: 3,
    make: (r) => {
      const s = int(r, 2, 15);
      const c = s * s;
      return {
        prompt: `In the equation $x^2 + bx + ${c} = 0$, $b$ is a positive constant. If the equation has exactly one real solution, what is the value of $b$?`,
        answer: [String(2 * s)],
        explain: `Нэг л бодит шийдтэй бол дискриминант $0$: $b^2 - 4\\cdot 1\\cdot ${c} = 0$, $b^2 = ${4 * c}$, $b = ${2 * s}$ (эерэг). Шалгах: $x^2 + ${2 * s}x + ${c} = (x + ${s})^2$.`,
        hint: 'Яг нэг шийд $\\Rightarrow$ $b^2 - 4ac = 0$.',
        desmos: {
          rows: [`y=x^2+bx+${c}`, 'b=1'],
          tip: `$b$ гулсуурыг парабол $x$ тэнхлэгт яг шүргэх хүртэл хөдөлгө: $b = ${2 * s}$.`,
        },
        mn: 'exactly one real solution = яг нэг бодит шийд',
        vocab: ['exactly one', 'real solution'],
      };
    },
  },
  {
    key: 'circle-general',
    domain: 'geo',
    skill: 'Circles',
    difficulty: 3,
    make: (r) => {
      const h = nonZero(r, -6, 6);
      const k = nonZero(r, -6, 6);
      const rad = int(r, 2, 9);
      const D = -2 * h;
      const E = -2 * k;
      const F = h * h + k * k - rad * rad;
      const eq = `x^2 + y^2 ${term(D)}x ${term(E)}y${F ? ` ${term(F)}` : ''} = 0`;
      return {
        prompt: `The equation $${eq}$ defines a circle in the $xy$-plane. What is the radius of the circle?`,
        answer: [String(rad)],
        explain: `Квадрат гүйцээ: $(x ${term(-h)})^2 + (y ${term(-k)})^2 = ${h * h} + ${k * k} ${term(-F)} = ${rad * rad}$. Радиус $= \\sqrt{${rad * rad}} = ${rad}$, төв $(${h}, ${k})$.`,
        hint: '$x$-үүдийг, $y$-үүдийг бүлэглээд тус бүрт нь квадрат гүйцээ: $x^2 + Dx = (x + D/2)^2 - (D/2)^2$.',
        desmos: { rows: [row(eq)], tip: `Тойргийн хамгийн баруун цэгээс төв хүртэлх зай нь радиус: ${rad}.` },
        mn: 'radius = радиус, defines = тодорхойлно',
        vocab: ['radius', 'circle'],
      };
    },
  },
  {
    key: 'line-parabola-sum',
    domain: 'adv',
    skill: 'Nonlinear systems',
    difficulty: 3,
    make: (r) => {
      const r1 = int(r, -6, 8);
      const r2 = int(r, -6, 8);
      if (r1 === r2) return null;
      const m = nonZero(r, -4, 4);
      const b = int(r, -9, 9);
      const p = m - r1 - r2;
      const q = b + r1 * r2;
      return {
        prompt: `In the $xy$-plane, the graphs of $y = ${poly2(1, p, q)}$ and $y = ${lin(m, b)}$ intersect at two points. What is the sum of the $x$-coordinates of the two points?`,
        answer: [String(r1 + r2)],
        explain: `Тэнцүүл: $${poly2(1, p, q)} = ${lin(m, b)}$ $\\Rightarrow$ $${poly2(1, p - m, q - b)} = 0$ $\\Rightarrow$ $(x ${term(-r1)})(x ${term(-r2)}) = 0$. $x = ${r1}$ ба $x = ${r2}$, нийлбэр $${r1 + r2}$. (Товч арга: $x^2 + Bx + C = 0$-ийн шийдүүдийн нийлбэр $-B$.)`,
        hint: 'Хоёр $y$-г тэнцүүлээд бүгдийг нэг тал руу шилжүүл. Шийдүүдийн нийлбэр $= -b/a$.',
        desmos: {
          rows: [row(`y=${poly2(1, p, q)}`), row(`y=${lin(m, b)}`)],
          tip: `Хоёр огтлолцлын цэг дээр дар: $x = ${r1}$ ба $x = ${r2}$. Нийлбэр $${r1 + r2}$.`,
        },
        mn: 'intersect = огтлолцох, x-coordinates = x координатууд',
        vocab: ['intersect', 'coordinates', 'sum'],
      };
    },
  },
  {
    key: 'pct-compound',
    domain: 'psda',
    skill: 'Percentages',
    difficulty: 3,
    make: (r) => {
      const p = pick(r, [5, 10, 20, 25, 30, 40, 50, 60] as const);
      const n = pick(r, [2, 2, 3] as const);
      const total = Math.round(((1 + p / 100) ** n - 1) * 1000) / 10;
      const naive = p * n;
      const q = mcq(r, `${total}\\%`, [
        { tex: `${naive}\\%`, why: `Хувийг зүгээр нэмж болохгүй — жил бүр өмнөх жилийнхээ ${p}%-иар өсдөг.` },
        {
          tex: `${Math.round((1 + p / 100) ** n * 1000) / 10}\\%`,
          why: 'Энэ бол шинэ хэмжээ (анхныхыг 100% гэвэл), өсөлт биш.',
        },
        { tex: `${p ** n}\\%`, why: 'Хувиудыг үржүүлэхгүй — $(1 + p)^n$ хэлбэрээр бод.' },
      ]);
      if (!q) return null;
      return {
        prompt: `A quantity increases by $${p}\\%$ every year. By what percent does the quantity increase every ${n} years?`,
        ...q,
        explain: `Жил бүр $\\times ${1 + p / 100}$. ${n} жилд $${1 + p / 100}^{${n}} = ${Math.round((1 + p / 100) ** n * 1000) / 1000}$. Тэгэхээр өсөлт $${total}\\%$.`,
        hint: `${p}% өсөх = $${1 + p / 100}$-ээр үржих. ${n} удаа үржүүлээд $1$-ийг хас.`,
        mn: 'increases by = ...-аар өснө',
        vocab: ['percent', 'increase'],
      };
    },
  },
  {
    key: 'pct-reverse',
    domain: 'psda',
    skill: 'Percentages',
    difficulty: 3,
    make: (r) => {
      const p = pick(r, [10, 20, 25, 50] as const);
      const q = pick(r, [10, 20, 25, 40, 50] as const);
      const orig = 20 * int(r, 3, 40);
      const fin = (orig * (100 + p) * (100 - q)) / 10000;
      if (!Number.isInteger(fin)) return null;
      return {
        prompt: `The price of a jacket was increased by $${p}\\%$, and then the new price was decreased by $${q}\\%$. The final price was $\\$${fin}$. What was the original price, in dollars?`,
        answer: [String(orig)],
        explain: `Анхны үнэ $x$ бол $x \\cdot ${(100 + p) / 100} \\cdot ${(100 - q) / 100} = ${fin}$. $${(100 + p) / 100} \\cdot ${(100 - q) / 100} = ${((100 + p) * (100 - q)) / 10000}$, тэгэхээр $x = ${fin} / ${((100 + p) * (100 - q)) / 10000} = ${orig}$.`,
        hint: 'Хувийг шууд хасаж болохгүй. Анхны үнийг $x$ гэж тавиад хоёр үржигдэхүүнээр үржүүл.',
        mn: 'original price = анхны үнэ, final = эцсийн',
        vocab: ['original', 'final', 'decreased'],
      };
    },
  },
  {
    key: 'trig-cofunction',
    domain: 'geo',
    skill: 'Right triangle trigonometry',
    difficulty: 3,
    make: (r) => {
      const [x, y, z] = pick(r, TRIPLES);
      const s = int(r, 1, 3);
      const [a, b, c] = r() < 0.5 ? [x * s, y * s, z * s] : [y * s, x * s, z * s];
      const q = mcq(r, frac(b, a), [
        { tex: frac(a, b), why: '$\\tan A$-г олсон байна. $B$ өнцгийн эсрэг катет нь $b$.' },
        { tex: frac(b, c), why: '$\\cos A = \\sin B$ болохоос $\\tan B$ биш.' },
        { tex: frac(a, c), why: 'Энэ бол $\\sin A$.' },
      ]);
      if (!q) return null;
      return {
        prompt: `In right triangle $ABC$, angle $C$ is the right angle and $\\sin A = ${frac(a, c)}$. What is $\\tan B$?`,
        ...q,
        explain: `$\\sin A = \\frac{BC}{AB} = ${frac(a, c)}$ тул $BC = ${a / gcd(a, c)}k$, $AB = ${c / gcd(a, c)}k$. Пифагор: $AC = ${b / gcd(a, c)}k$. $\\tan B = \\frac{AC}{BC} = ${frac(b, a)}$.`,
        hint: 'Гурвалжин зураад талуудад тоо тавь. $B$ өнцгийн хувьд эсрэг катет нь аль тал вэ?',
        mn: 'right angle = тэгш өнцөг',
        vocab: ['right triangle', 'tan', 'sin'],
      };
    },
  },
  {
    key: 'radians',
    domain: 'geo',
    skill: 'Radians',
    difficulty: 3,
    make: (r) => {
      const d = pick(r, [
        15, 18, 20, 30, 36, 45, 60, 72, 75, 105, 120, 135, 150, 210, 225, 240, 270, 300, 315, 330,
      ] as const);
      const piFrac = (n: number, m: number) => {
        const g = gcd(n, m);
        const [a, b] = [n / g, m / g];
        const top = a === 1 ? '\\pi' : `${a}\\pi`;
        return b === 1 ? top : `\\frac{${top}}{${b}}`;
      };
      const q = mcq(r, piFrac(d, 180), [
        { tex: piFrac(d, 360), why: '$360$-аар биш, $180$-аар хуваана: $180^\\circ = \\pi$.' },
        { tex: piFrac(180, d), why: 'Харьцааг урвуу тавьсан байна.' },
        { tex: piFrac(2 * d, 180), why: '$2$-оор үржүүлэх шаардлагагүй.' },
      ]);
      if (!q) return null;
      return {
        prompt: `An angle has a measure of $${d}^\\circ$. What is the measure of the angle in radians?`,
        ...q,
        explain: `$180^\\circ = \\pi$ радиан. $${d}^\\circ \\cdot \\frac{\\pi}{180^\\circ} = ${piFrac(d, 180)}$.`,
        hint: '$180^\\circ$ нь $\\pi$ радиан. Градусыг $\\frac{\\pi}{180}$-аар үржүүл.',
        mn: 'measure = хэмжээ, radians = радиан',
        vocab: ['radians', 'measure'],
      };
    },
  },
  {
    key: 'outlier-mean',
    domain: 'psda',
    skill: 'Mean and outliers',
    difficulty: 3,
    make: (r) => {
      const n = int(r, 5, 7);
      // Pick a mean m and spread the values around it so they sum to n·m; the drop (out − m)/(n + 1) is then an integer.
      const m = int(r, 14, 26);
      const xs = Array.from({ length: n - 1 }, () => m + int(r, -6, 6));
      xs.push(n * m - xs.reduce((s, v) => s + v, 0));
      if (xs.some((v) => v < 5 || v > 40)) return null;
      const drop = int(r, 8, 14);
      const out = m + drop * (n + 1);
      const all = shuffleKeepLast(r, xs, out);
      const sumA = all.reduce((s, v) => s + v, 0);
      const sumX = sumA - out;
      return {
        prompt: `The data set $${all.join(', ')}$ contains one outlier. If the outlier is removed, by how much does the mean of the data set decrease?`,
        answer: [String(drop)],
        explain: `Бүгдийн нийлбэр $${sumA}$, ${all.length} тоо, дундаж $${sumA / all.length}$. Хэт утга $${out}$-ийг хасвал нийлбэр $${sumX}$, ${n} тоо, дундаж $${sumX / n}$. Буурах хэмжээ: $${sumA / all.length} - ${sumX / n} = ${drop}$.`,
        hint: 'Хэт утга (outlier) бусдаасаа хол байдаг тоо. Хоёр дунджийг тус тусад нь бодоод хас.',
        desmos: {
          rows: [`L=[${all.join(',')}]`, 'mean(L)'],
          tip: 'mean(L)-ийг бод, дараа нь хэт утгыг жагсаалтаас аваад дахин бод.',
        },
        mn: 'outlier = хэт утга, mean = дундаж',
        vocab: ['outlier', 'mean', 'decrease'],
      };
    },
  },
  {
    key: 'abs-ineq-count',
    domain: 'alg',
    skill: 'Absolute value inequalities',
    difficulty: 3,
    make: (r) => {
      const a = nonZero(r, -9, 9);
      const b = int(r, 2, 8);
      const strict = r() < 0.5;
      const count = strict ? 2 * b - 1 : 2 * b + 1;
      return {
        prompt: `How many integer values of $x$ satisfy $|x ${term(-a)}| ${strict ? '<' : '\\le'} ${b}$?`,
        answer: [String(count)],
        explain: `$${a - b} ${strict ? '<' : '\\le'} x ${strict ? '<' : '\\le'} ${a + b}$. Бүхэл тоонууд: ${strict ? `$${a - b + 1}$-ээс $${a + b - 1}$` : `$${a - b}$-ээс $${a + b}$`} хүртэл, нийт $${count}$.`,
        hint: `$|x - c| < d$ гэдэг нь $c - d < x < c + d$. Хил дээрх тоо орох уу гэдгийг тэмдгээс хар.`,
        mn: 'integer values = бүхэл утгууд, satisfy = хангах',
        vocab: ['integer', 'satisfy'],
      };
    },
  },
  {
    key: 'vertex-shift',
    domain: 'adv',
    skill: 'Function transformations',
    difficulty: 3,
    make: (r) => {
      const h = nonZero(r, -5, 5);
      const k = int(r, -6, 6);
      const s = nonZero(r, -4, 4);
      const t = nonZero(r, -5, 5);
      const vx = h - s;
      return {
        prompt: `The function $f$ is defined by $f(x) = ${poly2(1, -2 * h, h * h + k)}$. The function $g$ is defined by $g(x) = f(x ${term(s)}) ${term(-t)}$. What is the $x$-coordinate of the vertex of the graph of $y = g(x)$?`,
        answer: [String(vx)],
        explain: `Квадрат гүйцээ: $f(x) = (x ${term(-h)})^2 ${term(k)}$, орой $(${h}, ${k})$. $f(x ${term(s)})$ нь графикийг ${s > 0 ? 'зүүн' : 'баруун'} тийш $${Math.abs(s)}$ шилжүүлнэ: $x = ${h} - ${s < 0 ? `(${s})` : s} = ${vx}$. $${term(-t)}$ нь зөвхөн босоо шилжилт.`,
        hint: '$f(x + c)$ нь графикийг $c$-ийн эсрэг чиглэлд хэвтээ шилжүүлнэ. Эхлээд $f$-ийн оройг ол.',
        desmos: {
          rows: [row(`f(x)=${poly2(1, -2 * h, h * h + k)}`), row(`g(x)=f(x${term(s)})${term(-t)}`)],
          tip: `$g$-ийн хамгийн доод цэг дээр дар: $x = ${vx}$.`,
        },
        mn: 'vertex = орой, x-coordinate = x координат',
        vocab: ['vertex', 'graph'],
      };
    },
  },
];
