// Pitch demo: hand-written answers for a few fixed questions, used while the fine-tuned model is still training.
// The API marks these replies `sample: true` and the chat shows a small «Жишээ хариу» label, so it is never
// passed off as live model output. Delete this file (and its use in route.ts) once Suu is deployed.

/** Desmos lesson the reply links to (opens /desmos/ai?l=<id>). */
export type ScriptedLesson =
  | 'intersection'
  | 'slider'
  | 'regression'
  | 'statistics'
  | 'maxmin'
  | 'inequality';

type Script = { triggers: string[]; text: string; lesson?: ScriptedLesson };

/** Lowercase, drop markdown, spaces and punctuation so small typing differences still match. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replaceAll('**', '')
    .replaceAll('−', '-')
    .replaceAll('ё', 'е')
    .replace(/[\s.,!?;:«»"'()]/g, '');
}

const SCRIPTS: Script[] = [
  {
    triggers: ['3x+5=20'],
    lesson: 'intersection',
    text: [
      '**Desmos-оор 3 алхамд бодъё:**',
      '1) Тэгшитгэлийн (equation) зүүн талыг тусад нь бич: $y=3x+5$',
      '2) Баруун талыг бич: $y=20$',
      '3) Хоёр шулууны **огтлолцлын цэг** (intersection point) дээр дар → $(5,\\ 20)$ гарна.',
      '',
      'Цэгийн x-координат нь хариу: **x = 5**.',
      'Шалгах: $3\\cdot5+5=20$ ✓',
      '',
      'Desmos дээр алхам алхмаар харахыг хүсвэл доорх товчийг дар.',
    ].join('\n'),
  },
  {
    triggers: ['kx+3', 'шийдгүй', 'nosolution'],
    lesson: 'slider',
    text: [
      '**Ийм бодлогод Desmos-ын slider хамгийн хурдан:**',
      '1) Тогтмол шулууныг бич: $y=2x-1$',
      '2) $k=1$ гэж бич → Desmos автоматаар **slider** үүсгэнэ.',
      '3) Хоёр дахь шулууныг бич: $y=kx+3$',
      '4) Slider-ийг хөдөлгө. $k=2$ үед хоёр шулуун **параллель** (parallel) болж огтлолцохгүй.',
      '',
      'Огтлолцохгүй = **шийдгүй** (no solution). Хариу: **k = 2**.',
      'Шалгах: налалт (slope) ижил $2=2$, y-огтлолцол өөр $3\\ne-1$ ✓',
    ].join('\n'),
  },
  {
    triggers: ['(1,2)', '(3,8)', 'регресс', 'regression', 'налалт', 'slope'],
    lesson: 'regression',
    text: [
      '**Хүснэгт + регресс (regression) аргаар:**',
      '1) Desmos-д «+» → **table** нээ. $x_1$ баганад 1, 3, 5; $y_1$ баганад 2, 8, 14 гэж бич.',
      '2) Доор нь $y_1\\sim mx_1+b$ гэж бич.',
      '3) Desmos шууд $m=3$, $b=-1$ гэж гаргана.',
      '',
      '$m$ бол налалт (slope). Хариу: **3**.',
      'Шалгах: $\\frac{8-2}{3-1}=\\frac{6}{2}=3$ ✓',
    ].join('\n'),
  },
  {
    triggers: ['намайгшалгаач', 'quizme', 'стратегиар'],
    text: [
      'За, нэг асуулт! 🐱',
      '',
      '$2x+3y=12$ ба $x-y=1$ системийн шийд $(x,\\ y)$ бол $x+y$ хэд вэ?',
      '',
      '**Стратеги:** гараар орлуулахын оронд хоёр тэгшитгэлийг Desmos-д яг байгаагаар нь бичээд **огтлолцол** дээр дар. Энэ нь 10 секунд л болно.',
      'Хариугаа бичээд над руу явуул, би шалгая.',
    ].join('\n'),
  },
  {
    triggers: ['atleast', 'atmost'],
    text: [
      '**at least** = хамгийн багадаа → $\\ge$',
      '**at most** = хамгийн ихдээ → $\\le$',
      '',
      'Жишээ: «Тасалбар **at least** \\$15» → $p\\ge15$',
      '«Тэр **at most** 3 цаг унтсан» → $h\\le3$',
      '',
      '**Санах арга:** «least» = бага хэмжээ нь тогтсон, түүнээс дээш болно. SAT-д энэ хоёр үгийг андуурах нь хамгийн түгээмэл алдааны нэг.',
    ].join('\n'),
  },
  {
    triggers: ['төлөвлөгөө', 'studyplan'],
    text: [
      '**12-р сарын SAT хүртэл 6 долоо хоногийн төлөвлөгөө (өдөрт ~1.5 цаг):**',
      '1) **1-р долоо хоног — Оношлогоо:** богино тест, сул сэдвээ ол.',
      '2) **2–3 — Сул сэдэв:** замналын хичээл + Desmos Академи.',
      '3) **4 — Холимог:** хүнд асуултууд, цаг хэмжиж бод.',
      '4) **5 — Mock тест:** долоо хоногт 2 Mock тест, алдааны дэвтэр.',
      '5) **6 — Давталт:** томьёо, алдаа давтах, амрах.',
      '',
      'Өдөр бүрийн дэлгэрэнгүй хуваарийг **AI төлөвлөгөө** хэсгээс гаргаж болно.',
    ].join('\n'),
  },
  {
    triggers: ['ахиулах', 'raisemyscore', 'improve'],
    text: [
      '**SAT Math-ын оноо ахиулах 4 арга:**',
      '1) **Desmos-оо эзэмш.** Систем, квадрат тэгшитгэл, хүснэгтийн асуултын ихэнхийг Desmos 30 секундэд бодно.',
      '2) **Алдааны дэвтэр хөтөл.** Буруу хийсэн асуулт бүрийг 3 хоногийн дараа дахин бод.',
      '3) **Англи үгсээ мэд.** «at least», «directly proportional» зэрэг үгийн утгыг андуурах нь оноо алдуулдаг.',
      '4) **Цаг хэмжиж бод.** Нэг асуултад дунджаар 1.5 минут.',
    ].join('\n'),
  },
  {
    triggers: ['шугамантэгшитгэл', 'linearequation'],
    lesson: 'intersection',
    text: [
      '**Жишээ бодлого:** $3x+5=20$ бол $x$ хэд вэ?',
      '',
      'Гараар: хоёр талаас 5-ыг хас → $3x=15$ → 3-т хуваа → $x=5$.',
      'Desmos-оор: $y=3x+5$ ба $y=20$ гэж бичээд **огтлолцол** дээр дар → $(5,\\ 20)$.',
      '',
      'Одоо чи бод: $2x+7=3x-4$ бол $x$ хэд вэ?',
    ].join('\n'),
  },
];

/** The hand-written answer for a pitch question, or null when the message isn't one of them. */
export function scriptedReply(message: string): { text: string; lesson?: ScriptedLesson } | null {
  const m = normalize(message);
  const hit = SCRIPTS.find((s) => s.triggers.some((t) => m.includes(normalize(t))));
  return hit ? { text: hit.text, lesson: hit.lesson } : null;
}
