// Suu v2 · one model, several skills. The app picks a skill by sending its system prompt.
// No runtime imports: this file must run in Colab with plain `bun` (no node_modules).

/** Chat tutor prompt. Same text as ai/train/export.ts and src/server/tutor/ollama.ts (a test keeps them equal). */
export const CHAT_PROMPT =
  'Чи бол "Суу" — монгол сурагчдад SAT Math заадаг эелдэг багш. Үргэлж монголоор, богино, ойлгомжтой хариул. ' +
  'Математикийг $…$ дотор бич. Сурагч зөвлөгөө (hint) асуувал эцсийн хариуг БҮҮ хэл — зөвхөн дараагийн алхмыг заа. ' +
  'Тайлбар асуувал алхам алхмаар бодоод, төгсгөлд "Хариу: …" гэж бич.';

export const PLANNER_PROMPT =
  'Чи бол Суу-гийн "Төлөвлөгч" горим. Сурагчийн өгөгдлийг (JSON) уншаад сул сэдэв, хэв маягийг олж, ' +
  '7 хоногийн хичээлийн хуваарь гарга. Өдрийн минут тухайн өдрийн боломжит цагаас хэтрэхгүй, сурагчийн ' +
  'тэмдэглэлд завгүй гэсэн өдөр 0 минут. Зөвхөн JSON буцаа.';

export const ANALYZE_PROMPT =
  'Чи бол Суу-гийн "Шинжээч" горим. Сурагчийн алдааны жагсаалтыг (JSON) уншаад давтагдаж буй хэв маягийг ол: ' +
  'сэдэв, яарсан, удсан, Desmos, давтсан алдаа, сүүлийн асуултууд, англи үг. Тоог яг тоол. Зөвхөн JSON буцаа.';

/**
 * Desmos lesson prompt: the exact system prompt of the v1 training kit (sat_desmos_kit, data/*.jsonl).
 * The app sends it from src/server/ai/prompts.ts (a test keeps them equal). User message: desmosUserMessage().
 */
export const DESMOS_PROMPT =
  'Чи SAT Math-ийн багш. Desmos-оор заах нь чиний гол арга. Асуулт болон зөв хариуг өгөхөд хамгийн тохирох ' +
  'Desmos аргыг сонгож, алхам бүрт Desmos-д юу хийхийг энгийн монголоор тайлбарла. Зөвхөн JSON буцаа: ' +
  '{"technique":...,"steps":[{"text":...,"desmos":[...],"bounds":{...}}],"check":...,"answer":...}';

export type Skill = 'chat' | 'planner' | 'analyze' | 'stepcheck' | 'desmos';

/** System prompt per skill. `desmos` comes from the v1 training kit, so the notebook fills it in. */
export const PROMPTS: Record<Exclude<Skill, 'desmos'>, string> = {
  chat: CHAT_PROMPT,
  planner: PLANNER_PROMPT,
  analyze: ANALYZE_PROMPT,
  // Checking a student's written steps is a chat skill: same prompt, so it works inside the normal Suu chat.
  stepcheck: CHAT_PROMPT,
};

export type Message = { role: 'system' | 'user' | 'assistant'; content: string };

/** One training/eval row. `check` holds what the scorer needs that is not in the messages. */
export type Row = {
  skill: Skill;
  id: string;
  messages: Message[];
  check?: Record<string, unknown>;
};

/** Monday-first Mongolian weekday short names, as the app shows them. */
export const DAYS = ['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'] as const;
export type Day = (typeof DAYS)[number];

/** Full weekday names used in student notes → short name. */
export const DAY_NAMES: Record<Day, string> = {
  Да: 'Даваа',
  Мя: 'Мягмар',
  Лх: 'Лхагва',
  Пү: 'Пүрэв',
  Ба: 'Баасан',
  Бя: 'Бямба',
  Ня: 'Ням',
};

/** Short Mongolian names of the 26 roadmap topics (same ids as src/features/roadmap/topics.ts). */
export const TOPIC_NAMES: Record<number, string> = {
  1: 'Нэг хувьсагчтай шугаман тэгшитгэл',
  2: 'Хоёр хувьсагчтай шугаман тэгшитгэл',
  3: 'Шугаман функц',
  4: 'Шугаман тэгшитгэлийн систем',
  5: 'Системийн шийдийн тоо',
  6: 'Шугаман тэнцэтгэл биш',
  7: 'Харьцаа, хурд, пропорц',
  8: 'Нэгж хөрвүүлэлт',
  9: 'Хувь',
  10: 'Дундаж, медиан, тархалт',
  11: 'Цэгэн график, загвар',
  12: 'Магадлал',
  13: 'Түүврийн дүгнэлт',
  14: 'Статистик дүгнэлтийг үнэлэх',
  15: 'Олон гишүүнт',
  16: 'Зэрэг, язгуур',
  17: 'Квадрат тэгшитгэл',
  18: 'Шугаман бус систем',
  19: 'Квадрат функц ба парабол',
  20: 'Илтгэгч функц',
  21: 'Функцийн тэмдэглэгээ',
  22: 'Шулуун, өнцөг, гурвалжин',
  23: 'Пифагор',
  24: 'Тригонометр',
  25: 'Тойрог',
  26: 'Талбай ба эзэлхүүн',
};

/** Topics where Desmos usually solves the question fastest. */
export const DESMOS_TOPICS = new Set([1, 2, 3, 4, 5, 6, 11, 17, 18, 19, 20, 21, 25]);

/** Share of letters that are Cyrillic (math and English terms are allowed around it). */
export function mongolianShare(text: string): number {
  const letters = [...text.replace(/\$[^$]*\$/g, '')].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  return letters.filter((c) => /[Ѐ-ӿ]/.test(c)).length / letters.length;
}
