// Pitch demo: six hand-written Desmos lessons (math checked by the Desmos verifier in the training kit).
// Shown on /desmos/ai with a «Жишээ хичээл» label until the fine-tuned model writes them live.

export type DesmosItem = {
  latex?: string;
  type?: 'table';
  columns?: { latex: string; values: string[] }[];
  color?: 'blue' | 'red' | 'green' | 'purple' | 'orange' | 'black';
  label?: string;
  showLabel?: boolean;
  sliderBounds?: { min: string; max: string; step: string };
  lineStyle?: 'DASHED';
};

export type DesmosStep = {
  /** Short step heading, e.g. «Огтлолцлыг ол». */
  title: string;
  text: string;
  desmos: DesmosItem[];
  bounds?: { left: number; right: number; bottom: number; top: number };
};

export type DesmosAiLesson = {
  id: string;
  title: string;
  question: string;
  answer: string;
  check: string;
  /** Words in a typed question that pick this lesson. */
  match: string[];
  steps: DesmosStep[];
};

export const DESMOS_AI_LESSONS: DesmosAiLesson[] = [
  {
    id: 'intersection',
    title: 'Огтлолцол',
    question: 'If 3x + 5 = 20, what is the value of x?',
    answer: 'x = 5',
    check: '3·5 + 5 = 20 ✓',
    match: ['3x+5', '3x + 5'],
    steps: [
      {
        title: 'Зүүн талыг зур',
        text: 'Тэгшитгэлийн (equation) зүүн талыг шулуун болгож бич: y = 3x + 5.',
        desmos: [
          {
            latex: 'y=3x+5',
            color: 'blue',
          },
        ],
        bounds: {
          left: -2,
          right: 10,
          bottom: -5,
          top: 30,
        },
      },
      {
        title: 'Баруун талыг зур',
        text: 'Баруун талыг бас шулуун болгож бич: y = 20.',
        desmos: [
          {
            latex: 'y=20',
            color: 'red',
          },
        ],
      },
      {
        title: 'Огтлолцлыг ол',
        text: 'Хоёр шулууны огтлолцлын цэг (intersection point) дээр дар. (5, 20) гарна. x = 5.',
        desmos: [
          {
            latex: '\\left(5,20\\right)',
            color: 'green',
            label: 'x = 5',
            showLabel: true,
          },
        ],
      },
    ],
  },
  {
    id: 'regression',
    title: 'Хүснэгт + регресс',
    question: 'A line passes through the points (1, 2), (3, 8) and (5, 14). What is the slope of the line?',
    answer: '3',
    check: '(8 − 2) / (3 − 1) = 6 / 2 = 3 ✓',
    match: ['(1,2)', '(1, 2)', 'slope', 'налалт'],
    steps: [
      {
        title: 'Хүснэгт оруул',
        text: 'Цэгүүдийг хүснэгт (table) болгож оруул. Desmos-д + товч → table.',
        desmos: [
          {
            type: 'table',
            columns: [
              {
                latex: 'x_1',
                values: ['1', '3', '5'],
              },
              {
                latex: 'y_1',
                values: ['2', '8', '14'],
              },
            ],
          },
        ],
        bounds: {
          left: -1,
          right: 7,
          bottom: -2,
          top: 16,
        },
      },
      {
        title: 'Регресс бич',
        text: 'Шугаман регресс (linear regression) бич: y₁ ~ m x₁ + b. Desmos m ба b-г шууд гаргана.',
        desmos: [
          {
            latex: 'y_1\\sim mx_1+b',
            color: 'purple',
          },
        ],
      },
      {
        title: 'Налалтыг унш',
        text: 'm = 3 гарна. Энэ бол налалт (slope).',
        desmos: [],
      },
    ],
  },
  {
    id: 'slider',
    title: 'Slider',
    question: 'For what value of k does the system y = kx + 3 and y = 2x - 1 have no solution?',
    answer: 'k = 2',
    check: 'Налалт ижил (2 = 2), y-тэнхлэгийн огтлолцол өөр (3 ≠ −1) → шийдгүй ✓',
    match: ['kx', 'no solution', 'шийдгүй'],
    steps: [
      {
        title: 'Тогтмол шулууныг зур',
        text: 'Эхний шулууныг бич: y = 2x − 1.',
        desmos: [
          {
            latex: 'y=2x-1',
            color: 'blue',
          },
        ],
        bounds: {
          left: -6,
          right: 6,
          bottom: -6,
          top: 8,
        },
      },
      {
        title: 'k-д slider үүсгэ',
        text: 'k-г slider болгож үүсгэ. k = 1 гэж бичээд slider-ийн хязгаарыг −5-аас 5 болго.',
        desmos: [
          {
            latex: 'k=1',
            sliderBounds: {
              min: '-5',
              max: '5',
              step: '0.5',
            },
          },
        ],
      },
      {
        title: 'k-тэй шулууныг зур',
        text: 'Хоёр дахь шулууныг бич: y = kx + 3. Slider-ийг хөдөлгө.',
        desmos: [
          {
            latex: 'y=kx+3',
            color: 'red',
          },
        ],
      },
      {
        title: 'Параллель болгох',
        text: 'k = 2 үед хоёр шулуун параллель (parallel) болж огтлолцохгүй. Тиймээс шийдгүй (no solution).',
        desmos: [
          {
            latex: 'k=2',
          },
        ],
      },
    ],
  },
  {
    id: 'statistics',
    title: 'Жагсаалт + дундаж',
    question: 'The data set 4, 7, 7, 9, 13 is given. What is the mean of the data set?',
    answer: '8',
    check: '(4 + 7 + 7 + 9 + 13) / 5 = 40 / 5 = 8 ✓',
    match: ['mean', 'дундаж', '4, 7, 7'],
    steps: [
      {
        title: 'Жагсаалт үүсгэ',
        text: 'Өгөгдлийг жагсаалт (list) болгож бич: d₁ = [4, 7, 7, 9, 13].',
        desmos: [
          {
            latex: 'd_1=\\left[4,7,7,9,13\\right]',
          },
        ],
      },
      {
        title: 'Дунджийг бод',
        text: 'Дундаж (mean) функцийг бич: mean(d₁). 8 гарна.',
        desmos: [
          {
            latex: '\\operatorname{mean}\\left(d_1\\right)',
          },
        ],
      },
      {
        title: 'Медиантай харьцуул',
        text: 'Нэмэлт: median(d₁) = 7. SAT-д mean ба median-ийг харьцуулах асуулт их гардаг.',
        desmos: [
          {
            latex: '\\operatorname{median}\\left(d_1\\right)',
          },
        ],
      },
    ],
  },
  {
    id: 'maxmin',
    title: 'Хамгийн их утга',
    question:
      "A ball's height is h(t) = -5t² + 20t + 1 meters after t seconds. What is the maximum height of the ball?",
    answer: '21 метр',
    check: '−5·4 + 20·2 + 1 = −20 + 40 + 1 = 21 ✓',
    match: ['height', 'өндөр', 'maximum'],
    steps: [
      {
        title: 'Функцээ зур',
        text: 'Функцийг x-ээр бич. Хугацаа сөрөг байж болохгүй тул хязгаарлалт (restriction) {x ≥ 0} нэм.',
        desmos: [
          {
            latex: 'y=-5x^2+20x+1\\left\\{x\\ge0\\right\\}',
            color: 'blue',
          },
        ],
        bounds: {
          left: -1,
          right: 5,
          bottom: -3,
          top: 25,
        },
      },
      {
        title: 'Оройн цэгийг ол',
        text: 'Параболын хамгийн өндөр цэг (maximum) дээр дар. (2, 21) гарна.',
        desmos: [
          {
            latex: '\\left(2,21\\right)',
            color: 'green',
            label: 'max: 21 м',
            showLabel: true,
          },
        ],
      },
    ],
  },
  {
    id: 'inequality',
    title: 'Тэнцэтгэл биш',
    question:
      'Which point is a solution to the system y > 2x + 1 and y < -x + 5? (A) (0, 0) (B) (1, 3) (C) (-1, 2) (D) (2, 4)',
    answer: 'C',
    check: 'C: 2 > 2·(−1) + 1 = −1 ✓, 2 < 1 + 5 = 6 ✓',
    match: ['inequal', 'тэнцэтгэл', 'y > 2x'],
    steps: [
      {
        title: 'Тэнцэтгэл бишүүдийг зур',
        text: 'Хоёр тэнцэтгэл бишийг (inequality) бич. Хоёулаа будагдсан хэсэг нь шийд.',
        desmos: [
          {
            latex: 'y>2x+1',
            color: 'blue',
          },
          {
            latex: 'y<-x+5',
            color: 'red',
          },
        ],
        bounds: {
          left: -4,
          right: 5,
          bottom: -3,
          top: 7,
        },
      },
      {
        title: 'Хариултын цэгүүдийг оруул',
        text: 'Хариултын 4 цэгийг шошготой (label) оруул.',
        desmos: [
          {
            latex: '\\left(0,0\\right)',
            label: 'A',
            showLabel: true,
            color: 'black',
          },
          {
            latex: '\\left(1,3\\right)',
            label: 'B',
            showLabel: true,
            color: 'black',
          },
          {
            latex: '\\left(-1,2\\right)',
            label: 'C',
            showLabel: true,
            color: 'black',
          },
          {
            latex: '\\left(2,4\\right)',
            label: 'D',
            showLabel: true,
            color: 'black',
          },
        ],
      },
      {
        title: 'Шийдийг сонго',
        text: 'Зөвхөн C цэг хоёр өнгө давхцсан хэсэгт байна. B нь шулуун дээр байгаа тул тооцогдохгүй (> тэмдэг).',
        desmos: [],
      },
    ],
  },
];

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '').replaceAll('−', '-');

/** The lesson for a typed question, or null when it isn't one of the demo questions. */
export function findLesson(question: string): DesmosAiLesson | null {
  const q = squash(question);
  if (!q) return null;
  return (
    DESMOS_AI_LESSONS.find((l) => squash(l.question) === q || l.match.some((m) => q.includes(squash(m)))) ??
    null
  );
}
