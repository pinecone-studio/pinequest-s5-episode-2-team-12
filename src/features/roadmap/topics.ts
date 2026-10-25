// The 26 SAT Math topics, one per stop, mapped to the College Board domain and skill taxonomy.
// Only the taxonomy is College Board's; every question in content/roadmap is an original Suprep item.
import type { Domain } from '@/types';
import type { CbDomain, Topic } from './types';

const ALG: CbDomain = 'Algebra';
const PSDA: CbDomain = 'Problem-Solving and Data Analysis';
const ADV: CbDomain = 'Advanced Math';
const GEO: CbDomain = 'Geometry and Trigonometry';

const DOMAIN_OF: Record<CbDomain, Domain> = {
  Algebra: 'alg',
  'Problem-Solving and Data Analysis': 'psda',
  'Advanced Math': 'adv',
  'Geometry and Trigonometry': 'geo',
};

const t = (id: number, title: string, cbDomain: CbDomain, cbSkill: string, icon: string): Topic => ({
  id,
  title,
  cbDomain,
  cbSkill,
  domain: DOMAIN_OF[cbDomain],
  icon,
});

export const TOPICS: Topic[] = [
  t(1, 'Нэг хувьсагчтай шугаман тэгшитгэл', ALG, 'Linear equations in one variable', 'eq'),
  t(
    2,
    'Хоёр хувьсагчтай шугаман тэгшитгэл (налуу, огтлол)',
    ALG,
    'Linear equations in two variables',
    'slope',
  ),
  t(3, 'Шугаман функц ба загварчлал', ALG, 'Linear functions', 'line'),
  t(4, 'Шугаман тэгшитгэлийн систем', ALG, 'Systems of two linear equations in two variables', 'system'),
  t(
    5,
    'Системийн шийдийн тоо (0, 1, хязгааргүй)',
    ALG,
    'Systems of two linear equations in two variables',
    'parallel',
  ),
  t(6, 'Шугаман тэнцэтгэл биш', ALG, 'Linear inequalities in one or two variables', 'ineq'),
  t(7, 'Харьцаа, хурд, пропорц', PSDA, 'Ratios, rates, proportional relationships, and units', 'ratio'),
  t(8, 'Нэгж хөрвүүлэлт', PSDA, 'Ratios, rates, proportional relationships, and units', 'unit'),
  t(9, 'Хувь', PSDA, 'Percentages', 'percent'),
  t(
    10,
    'Нэг хувьсагчтай өгөгдөл: дундаж, медиан, тархалт',
    PSDA,
    'One-variable data: distributions and measures of center and spread',
    'bars',
  ),
  t(
    11,
    'Хоёр хувьсагчтай өгөгдөл: цэгэн график, загвар',
    PSDA,
    'Two-variable data: models and scatterplots',
    'scatter',
  ),
  t(12, 'Магадлал ба нөхцөлт магадлал', PSDA, 'Probability and conditional probability', 'dice'),
  t(
    13,
    'Түүврийн дүгнэлт ба алдааны хязгаар',
    PSDA,
    'Inference from sample statistics and margin of error',
    'sample',
  ),
  t(
    14,
    'Статистик дүгнэлтийг үнэлэх (туршилт, ажиглалт)',
    PSDA,
    'Evaluating statistical claims: observational studies and experiments',
    'claim',
  ),
  t(15, 'Олон гишүүнтийн үйлдэл ба задаргаа', ADV, 'Equivalent expressions', 'poly'),
  t(16, 'Зэрэг, язгуур, рационал илэрхийлэл', ADV, 'Equivalent expressions', 'power'),
  t(
    17,
    'Квадрат тэгшитгэл',
    ADV,
    'Nonlinear equations in one variable and systems of equations in two variables',
    'quad',
  ),
  t(
    18,
    'Шугаман бус систем, язгууртай/рационал тэгшитгэл',
    ADV,
    'Nonlinear equations in one variable and systems of equations in two variables',
    'cross',
  ),
  t(19, 'Квадрат функц ба парабол', ADV, 'Nonlinear functions', 'parabola'),
  t(20, 'Илтгэгч функц: өсөлт ба бууралт', ADV, 'Nonlinear functions', 'exp'),
  t(21, 'Функцийн тэмдэглэгээ, хувиргалт, олон гишүүнт функц', ADV, 'Nonlinear functions', 'shift'),
  t(22, 'Шулуун, өнцөг, гурвалжин (төсөөтэй гурвалжин)', GEO, 'Lines, angles, and triangles', 'angle'),
  t(23, 'Тэгш өнцөгт гурвалжин, Пифагор', GEO, 'Right triangles and trigonometry', 'right'),
  t(24, 'Тригонометр (sin, cos, tan, радиан)', GEO, 'Right triangles and trigonometry', 'trig'),
  t(25, 'Тойрог (нум, сектор, тойргийн тэгшитгэл)', GEO, 'Circles', 'circle'),
  t(26, 'Талбай ба эзэлхүүн', GEO, 'Area and volume', 'cube'),
];

export function topicById(id: number): Topic | undefined {
  return TOPICS.find((x) => x.id === id);
}
