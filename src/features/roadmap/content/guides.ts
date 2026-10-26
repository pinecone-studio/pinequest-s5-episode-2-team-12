// What each roadmap topic teaches, for the stop panel: a short summary, learning goals, key formulas (TeX)
// and links into the rest of the app (flashcards `deck/card`, Desmos lessons, journey lessons).
// Drafts written for Suprep: `reviewed: false` until a teacher checks them.
export type TopicGuide = {
  topicId: number;
  /** 2–3 sentences: what the student will learn. */
  summary: string;
  goals: string[];
  /** TeX, rendered with KaTeX. */
  formulas: string[];
  /** Flashcards as `deckId/cardId` (content/cards). */
  cards: string[];
  /** Desmos Academy lesson ids (src/mocks/desmos.ts). */
  desmos: string[];
  /** Journey lesson ids shown as «Товч хичээл». */
  lessons: string[];
  reviewed: boolean;
};

export const GUIDES: TopicGuide[] = [
  {
    topicId: 1,
    summary:
      'Ижил суурьтай зэргүүдийг үржүүлэхэд зэргийг нэмнэ, хуваахад хасна. Зэргийг зэрэгт дэвшүүлэхэд зэргүүдийг үржүүлнэ.',
    goals: [
      'Зэргийн үржүүлэх ба хуваах дүрмийг хэрэглэх',
      'Бутархай зэргийг язгуурт шилжүүлэх',
      'Тодорхойлогдох муж ба модулийг шалгах',
    ],
    formulas: ['a^ma^n=a^{m+n}'],
    cards: ['algebra/exponent'],
    desmos: [],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 2,
    summary:
      'Илэрхийлэл нь тэнцүүгийн тэмдэггүй, утга дүрсэлдэг бичлэг. Төсөөтэй гишүүдийг нэгтгэж, хаалт задлаж, нийтлэг үржигдэхүүнийг гаргана.',
    goals: [
      'Төсөөтэй гишүүдийг нэгтгэж хаалт задлах',
      'Олон гишүүнтийг үржигдэхүүнд задлах',
      'Рационал илэрхийллийг зөвшөөрөгдөх мужтай нь хураах',
    ],
    formulas: ['a^2-b^2=(a-b)(a+b)'],
    cards: ['algebra/coefficient', 'algebra/constant', 'compare/equivalent'],
    desmos: [],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 3,
    summary: 'Тэгшитгэл бол хоёр илэрхийллийн тэнцэл. Хоёр талд ижил үйлдэл хийж тэнцлийг хадгална.',
    goals: [
      'Хоёр талд ижил үйлдэл хийж хувьсагчийг олох',
      'Үсгэн томьёог хүссэн хувьсагчаар илэрхийлэх',
      'Нэг, тэг, хязгааргүй шийдтэй тохиолдлыг ялгах',
    ],
    formulas: ['ax+b=c\\Rightarrow x=\\frac{c-b}{a}\\quad(a\\ne0)'],
    cards: ['ops/sum', 'ops/difference', 'ops/product', 'ops/quotient', 'ops/twice'],
    desmos: ['d4'],
    lessons: ['s2-l2', 's1-l3'],
    reviewed: false,
  },
  {
    topicId: 4,
    summary:
      'Язгууртай, рационал, модультай тэгшитгэлд эхлээд тодорхойлогдох мужийг тогтооно. Язгуурыг ганцаарчлан квадратлах, ерөнхий хуваарьт үржүүлэх, эсвэл модулийн хоёр тохиолдлыг тусад нь бодно.',
    goals: [
      'Язгууртай ба рационал тэгшитгэлийг бодох',
      'Модультай тэгшитгэлийн хоёр тохиолдлыг шалгах',
      'Илүү шийд ба хориотой утгыг хасах',
    ],
    formulas: ['|u|=a\\Rightarrow u=a\\text{ эсвэл }u=-a\\quad(a\\ge0)'],
    cards: ['algebra/intersect', 'algebra/solution'],
    desmos: ['d3', 'd4'],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 5,
    summary:
      'Функц нь оролт бүрт нэг л гаралт онооно. $f(3)$ гэдэг нь томьёоны $x$ бүрийн оронд $3$ орлуулахыг хэлнэ.',
    goals: [
      'Функцийн утгыг орлуулж олох',
      'Нийлмэл функцийг дотроос нь бодох',
      'Тодорхойлогдох муж ба оролт-гаралтыг ялгах',
    ],
    formulas: ['(f\\circ g)(x)=f(g(x))'],
    cards: ['algebra/solution'],
    desmos: ['d2', 'd5'],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 6,
    summary:
      'Шулууны налуу нь $x$ нэг нэгжээр өсөхөд $y$ хэдээр өөрчлөгдөхийг хэмжинэ. $y=mx+b$ хэлбэрт $m$ налуу, $b$ нь $y$-тэнхлэгийн огтлол.',
    goals: [
      'Хоёр цэгээр налуу олох',
      'Налуу ба огтлолоор шулууны тэгшитгэл бичих',
      'Параллель ба перпендикуляр шулуун таних',
    ],
    formulas: ['m=\\frac{y_2-y_1}{x_2-x_1}'],
    cards: ['algebra/slope', 'algebra/intercept', 'f-memo/f-slope', 'geo/perpendicular'],
    desmos: ['d2'],
    lessons: ['s2-l4'],
    reviewed: false,
  },
  {
    topicId: 7,
    summary:
      'Бодит нөхцөлд $y=mx+b$ загварын $b$ нь эхний хэмжээ, $m$ нь нэг оролтын нэгж тутмын өөрчлөлт. Хариулахдаа тоог дангаар нь бус, хэмжих нэгжтэй нь тайлбарлана.',
    goals: [
      'Налууг хэмжих нэгжтэй нь тайлбарлах',
      'Огтлолыг эхний хэмжээтэй холбох',
      'Загвараас хэмжээний өөрчлөлтийг тооцох',
    ],
    formulas: ['\\text{өөрчлөлт}=m\\cdot\\text{оролтын өөрчлөлт}'],
    cards: ['algebra/slope', 'algebra/constant', 'algebra/coefficient'],
    desmos: ['d2', 'd6'],
    lessons: ['s2-l4'],
    reviewed: false,
  },
  {
    topicId: 8,
    summary: 'Хувийг зууны нэгжээр илэрхийлнэ. $p\\%$ өсөлтөд $1+p/100$, бууралтад $1-p/100$-аар үржүүлнэ.',
    goals: [
      'Хувийг үржүүлэгч болгох',
      'Хувийн өсөлт ба бууралтыг дараалуулан бодох',
      'Хувь ба хувийн пунктыг ялгах',
    ],
    formulas: ['\\%\\text{ өөрчлөлт}=\\frac{\\text{шинэ}-\\text{хуучин}}{\\text{хуучин}}\\cdot100'],
    cards: ['geo/percent', 'f-memo/f-pct'],
    desmos: [],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 9,
    summary:
      'Ижил хугацаанд ижил тоо нэмэгдэж байвал шугаман, ижил үржүүлэгчээр өөрчлөгдвөл илтгэгч загвар. $a$ нь эхний утга, $b$ нь нэг үеийн үржүүлэгч.',
    goals: [
      'Тогтмол зөрүү ба тогтмол харьцааг ялгах',
      'Шугаман ба илтгэгч загвар бичих',
      'Хугацааны нэгжид тохирсон зэрэг хэрэглэх',
    ],
    formulas: ['L(t)=a+dt,\\qquad E(t)=ab^t'],
    cards: ['algebra/exponent', 'geo/percent'],
    desmos: ['d5'],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 10,
    summary:
      'Харьцаа нь хэмжээнүүдийн холбоог, хурд нь нэгж хугацаанд ногдох хэмжээг илэрхийлнэ. Нэгж хөрвүүлэхдээ $1$-тэй тэнцүү хувиргах бутархайгаар үржүүлж илүүдэл нэгжүүдийг хураана.',
    goals: [
      'Харьцааг хэсгийн аргаар бодох',
      'Нэгж хурд ба хамтын хурд тооцох',
      'Урт, талбай, эзэлхүүний нэгж хөрвүүлэх',
    ],
    formulas: ['d=rt,\\qquad \\frac ab=\\frac cd\\Rightarrow ad=bc'],
    cards: ['geo/ratio', 'algebra/proportional'],
    desmos: [],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 11,
    summary:
      'Юуг олохоо нэрлэж хувьсагч тодорхойл. Хэмжих нэгжийг тэмдэглээд нөхцөлийн өгүүлбэр бүрийг тэгшитгэл эсвэл тэнцэтгэл биш болгоно.',
    goals: [
      'Үл мэдэгдэх хэмжээг хувьсагчаар тодорхойлох',
      'Өгүүлбэрээс тэгшитгэл байгуулах',
      'Хариуг нөхцөл ба хэмжих нэгжээр шалгах',
    ],
    formulas: ['\\text{нийт зардал}=\\text{суурь зардал}+\\text{нэгж үнэ}\\cdot\\text{тоо}'],
    cards: ['ops/sum', 'ops/difference', 'ops/product', 'ops/quotient', 'ops/twice'],
    desmos: ['d4'],
    lessons: ['s2-l2', 's1-l3'],
    reviewed: false,
  },
  {
    topicId: 12,
    summary:
      '$ax^2+bx+c=0$ ($a\\ne0$) тэгшитгэлийг үржигдэхүүнд задлах, бүтэн квадрат ялгах, квадрат томьёогоор бодно. Дискриминант $D=b^2-4ac$ нь бодит шийдийн тоог өгнө.',
    goals: [
      'Квадрат тэгшитгэлийг задаргаагаар бодох',
      'Квадрат томьёо ба дискриминант хэрэглэх',
      'Шийдийн нийлбэр ба үржвэрийг олох',
    ],
    formulas: ['x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}'],
    cards: ['algebra/quadratic', 'f-memo/f-quad', 'f-memo/f-disc'],
    desmos: ['d4'],
    lessons: ['s2-l6'],
    reviewed: false,
  },
  {
    topicId: 13,
    summary:
      'Системийн шийд нь бүх тэгшитгэлийг зэрэг хангах утгууд. Орлуулалт эсвэл нэмэх-хасах аргаар нэг хувьсагчийг арилгана.',
    goals: [
      'Орлуулалт ба нэмэх-хасах аргаар систем бодох',
      'Шийдийн тоог графикаар тайлбарлах',
      'Олсон хосыг хоёр тэгшитгэлд шалгах',
    ],
    formulas: ['\\begin{cases}a_1x+b_1y=c_1\\\\a_2x+b_2y=c_2\\end{cases}'],
    cards: ['algebra/solution', 'algebra/intersect'],
    desmos: ['d3'],
    lessons: ['s2-l5'],
    reviewed: false,
  },
  {
    topicId: 14,
    summary:
      'Шугаман тэнцэтгэл бишийг тэгшитгэлтэй адил хувиргана, гэхдээ сөрөг тоогоор үржүүлэх эсвэл хуваахад тэмдгийг эргүүлнэ. Хоёр хувьсагчтай бол заагийн шулуун ба зөв хагас хавтгайг сонгоно.',
    goals: [
      'Сөрөг тоогоор хуваахад тэмдэг эргүүлэх',
      'Хамгийн их ба бага бүхэл шийд олох',
      'Тэнцэтгэл бишийн системийн нийтлэг муж олох',
    ],
    formulas: ['a<b\\Rightarrow -a>-b'],
    cards: ['compare/atleast', 'compare/atmost', 'compare/inequality'],
    desmos: ['d2'],
    lessons: ['s2-l3'],
    reviewed: false,
  },
  {
    topicId: 15,
    summary:
      '$g(x)=a f(x-h)+k$ нь графикийг хэвтээгээр $h$, босоогоор $k$ шилжүүлнэ. $a$ нь босоо сунгалт, сөрөг бол $x$-тэнхлэгээр тусгал.',
    goals: [
      'Графикийг хэвтээ ба босоо шилжүүлэх',
      'Тусгал, сунгалт ба агшилтыг ялгах',
      'Хуучин цэгээс шинэ цэгийн координат олох',
    ],
    formulas: ['(x,y)\\mapsto(x+h,ay+k)'],
    cards: ['algebra/solution'],
    desmos: ['d2', 'd5'],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 16,
    summary: 'Квадрат функцийн график парабол. $a(x-h)^2+k$ хэлбэрээс орой $(h,k)$, тэнхлэг $x=h$ харагдана.',
    goals: [
      'Параболын орой ба тэнхлэг олох',
      'Хамгийн их ба бага утга тодорхойлох',
      'Стандарт ба оройн хэлбэрийг холбох',
    ],
    formulas: ['x_{\\text{орой}}=-\\frac b{2a}'],
    cards: ['algebra/vertex', 'algebra/quadratic', 'f-memo/f-vertex'],
    desmos: ['d5', 'd4'],
    lessons: ['s2-l6'],
    reviewed: false,
  },
  {
    topicId: 17,
    summary:
      'Шулуун өнцөг $180^\\circ$, бүтэн эргэлт $360^\\circ$. Эсрэг өнцгүүд тэнцүү; зэрэгцээ хоёр шулууныг огтолсон шулууны харгалзах болон солбисон дотоод өнцгүүд тэнцүү.',
    goals: [
      'Эсрэг ба шулуун хос өнцгийг таних',
      'Зэрэгцээ шулууны өнцгийн холбоог хэрэглэх',
      'Өнцгийн нөхцөлөөс хувьсагч олох',
    ],
    formulas: ['\\alpha+\\beta=180^\\circ\\quad\\text{(шулуун хос)}'],
    cards: ['geo/perpendicular'],
    desmos: [],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 18,
    summary:
      'Гурвалжны дотоод өнцгүүд $180^\\circ$. Төсөөтэй гурвалжны харгалзах талууд ижил харьцаатай, талын харьцаа $k$ бол талбайн харьцаа $k^2$.',
    goals: [
      'Гурвалжны өнцөг ба төсөөг ашиглах',
      'Пифагор ба тусгай гурвалжны харьцаа хэрэглэх',
      'Тал ба талбайн харьцааг ялгах',
    ],
    formulas: ['a^2+b^2=c^2'],
    cards: ['geo/hypotenuse', 'f-given/f-pyth', 'f-given/f-306090'],
    desmos: [],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 19,
    summary:
      'Тойргийн төвөөс бүх цэг хүртэл зай радиустай тэнцүү. Координатын тэгшитгэл $(x-h)^2+(y-k)^2=r^2$.',
    goals: [
      'Тойргийн тэгшитгэлээс төв ба радиус олох',
      'Бүтэн квадрат ялгаж тойргийн хэлбэрт оруулах',
      'Багтсан ба төвийн өнцгийн холбоог хэрэглэх',
    ],
    formulas: ['(x-h)^2+(y-k)^2=r^2'],
    cards: ['geo/radius', 'geo/circumference', 'f-given/f-carea', 'f-given/f-circ', 'f-memo/f-circeq'],
    desmos: ['d2'],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 20,
    summary:
      'Радиан нь төвийн өнцгийн тасалсан нумын уртыг радиуст хуваасан хэмжээ. $180^\\circ=\\pi$ радиан.',
    goals: [
      'Градус ба радианыг хөрвүүлэх',
      'Нумын урт ба секторын талбай олох',
      'Томьёонд өнцгийн зөв нэгж ашиглах',
    ],
    formulas: ['\\theta_{\\rm rad}=\\theta_{\\rm deg}\\frac{\\pi}{180},\\qquad s=r\\theta'],
    cards: ['geo/radian', 'f-given/f-deg'],
    desmos: [],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 21,
    summary:
      'Тэгш өнцөгт гурвалжинд сонгосон хурц өнцгийн эсрэг ба налсан катетыг ялгана. $\\sin$ нь эсрэг/гипотенуз, $\\cos$ нь налсан/гипотенуз, $\\tan$ нь эсрэг/налсан.',
    goals: [
      'Өнцөгт харгалзах эсрэг ба налсан талыг ялгах',
      'Синус, косинус, тангенсыг тооцох',
      'Нэмэлт өнцгийн тригонометрийн холбоог хэрэглэх',
    ],
    formulas: [
      '\\sin\\theta=\\frac{\\text{эсрэг}}{\\text{гипотенуз}},\\quad\\cos\\theta=\\frac{\\text{налсан}}{\\text{гипотенуз}}',
    ],
    cards: ['geo/radian', 'f-given/f-deg'],
    desmos: [],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 22,
    summary:
      'Периметр нь хилийн нийт урт, талбай нь гадаргуугийн хэмжээ, эзэлхүүн нь биетийн багтаамж. Нийлмэл дүрсийг хэсэгчилж нэмэх эсвэл нүхийг хасна.',
    goals: [
      'Периметр, талбай, эзэлхүүнийг ялгах',
      'Нийлмэл дүрс ба биетийг хэсэгчлэн бодох',
      'Хэмжээсийн өөрчлөлтөөс талбай ба эзэлхүүний өөрчлөлт олох',
    ],
    formulas: ['A_{\\triangle}=\\frac12bh,\\quad A_{\\circ}=\\pi r^2,\\quad V_{\\rm prism}=Bh'],
    cards: ['f-given/f-rect', 'f-given/f-tri', 'f-given/f-cyl', 'f-given/f-cone', 'f-given/f-sphere'],
    desmos: [],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 23,
    summary:
      'Хүснэгт, баганан болон цэгэн график уншихдаа тэнхлэг, нэгж, хуваарийг эхэлж шалгана. Трендийн шулуун нь ойролцоо таамаг өгнө.',
    goals: [
      'Хүснэгт ба графикийн нэгж, хуваарийг унших',
      'Трендийн шулуунаас таамаг гаргах',
      'Үлдэгдэл ба холбоо хамаарлыг тайлбарлах',
    ],
    formulas: ['\\text{үлдэгдэл}=y-\\hat y'],
    cards: ['algebra/slope'],
    desmos: ['d6'],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 24,
    summary:
      'Адил боломжтой үр дүнтэй үед магадлал нь таатай тоо/нийт тоо. Нөхцөлт магадлалд зөвхөн нөхцөл хангах бүлгийг шинэ нийт тоо болгоно.',
    goals: [
      'Таатай ба нийт үр дүнг зөв тоолох',
      'Нөхцөлт магадлалын зөв хуваарийг сонгох',
      'Давхцах үйл явдлыг хоёр удаа тоолохгүй байх',
    ],
    formulas: ['P(A\\mid B)=\\frac{P(A\\cap B)}{P(B)}\\quad(P(B)>0)'],
    cards: ['geo/probability'],
    desmos: [],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 25,
    summary:
      'Дундаж нь нийлбэр/тоо, медиан нь эрэмбэлсэн өгөгдлийн гол утга. Далайц нь ихээс багыг хассан дүн.',
    goals: [
      'Дундаж, медиан, далайц олох',
      'Хэт утга төв ба тархалтад хэрхэн нөлөөлөхийг тайлбарлах',
      'Өгөгдөлд тогтмол нэмэх ба үржүүлэх нөлөөг ялгах',
    ],
    formulas: ['\\bar x=\\frac{\\sum x_i}{n}'],
    cards: ['geo/mean', 'geo/median'],
    desmos: ['d6'],
    lessons: [],
    reviewed: false,
  },
  {
    topicId: 26,
    summary:
      'Санамсаргүй түүвэр нь эх олонлогийн талаар дүгнэхэд, санамсаргүй хуваарилалт нь туршилтын шалтгааны нөлөөг үнэлэхэд тусална. Алдааны хязгаар нь үнэлгээний тодорхой бус байдлыг илэрхийлнэ.',
    goals: [
      'Санамсаргүй түүврээс эх олонлогийг үнэлэх',
      'Алдааны хязгаар ба түүврийн хэмжээг холбох',
      'Ажиглалт, туршилт, шалтгаан ба ерөнхийлөлтийг ялгах',
    ],
    formulas: ['\\hat p\\pm E,\\qquad E\\propto\\frac1{\\sqrt n}'],
    cards: ['geo/mean', 'geo/percent'],
    desmos: [],
    lessons: [],
    reviewed: false,
  },
];

export function guideFor(topicId: number): TopicGuide | undefined {
  return GUIDES.find((x) => x.topicId === topicId);
}
