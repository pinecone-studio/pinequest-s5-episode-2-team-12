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

/**
 * The 26 roadmap topics by id, with the titles the app shows (src/features/roadmap/topics.ts; a test keeps them
 * equal). The model sees these ids and names in planner/analyze inputs, so they must be the app's own.
 */
export const TOPIC_NAMES: Record<number, string> = {
  1: 'Зэрэг ба язгуур',
  2: 'Алгебрын илэрхийлэл',
  3: 'Тэгшитгэл хувиргах ба бодох',
  4: 'Бусад төрлийн тэгшитгэл',
  5: 'Функц',
  6: 'Шулуун ба шугаман тэгшитгэл',
  7: 'Шугаман загварыг тайлбарлах',
  8: 'Хувь',
  9: 'Илтгэгч ба шугаман өсөлт',
  10: 'Хурд, нэгж хөрвүүлэлт ба харьцаа',
  11: 'Өгүүлбэртэй бодлого',
  12: 'Квадрат тэгшитгэл',
  13: 'Тэгшитгэлийн систем',
  14: 'Тэнцэтгэл биш',
  15: 'Функцийн хувиргалт',
  16: 'Квадрат функц',
  17: 'Өнцөг',
  18: 'Гурвалжин',
  19: 'Тойрог',
  20: 'Радиан',
  21: 'Тригонометр',
  22: 'Талбай, периметр ба эзэлхүүн',
  23: 'Өгөгдөл унших',
  24: 'Магадлал',
  25: 'Статистик I: төв ба тархалт',
  26: 'Статистик II: түүвэр ба дүгнэлт',
};

/**
 * Topics where Desmos usually solves the question fastest: at least 40% of the topic's bank questions come with
 * hand-written Desmos rows (equations, functions, systems, inequalities, quadratics, circles, data). Geometry,
 * trigonometry and probability are not Desmos topics.
 */
export const DESMOS_TOPICS = new Set([3, 6, 12, 13, 14, 16]);

/** Share of letters that are Cyrillic (math and English terms are allowed around it). */
export function mongolianShare(text: string): number {
  const letters = [...text.replace(/\$[^$]*\$/g, '')].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return 0;
  return letters.filter((c) => /[Ѐ-ӿ]/.test(c)).length / letters.length;
}
