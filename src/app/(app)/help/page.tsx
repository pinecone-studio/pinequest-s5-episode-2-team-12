import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { routes } from '@/lib/routes';

export const metadata = { title: 'Тусламж · SAT-ийн анхны алхам' };

const official = 'https://satsuite.collegeboard.org';
const sections = [
  { id: 'about', label: 'SAT гэж юу вэ?' },
  { id: 'desmos', label: 'Desmos гэж юу вэ?' },
  { id: 'register', label: 'Хэрхэн бүртгүүлэх вэ?' },
  { id: 'centers', label: 'Монгол дахь төвүүд' },
  { id: 'test-day', label: 'Шалгалтын өдрийн бэлтгэл' },
  { id: 'questions', label: 'Түгээмэл асуулт' },
];
const linkStyle = 'font-semibold text-leaf-2 underline underline-offset-4';

function Source({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkStyle}>
      {children} ↗
    </a>
  );
}

function Section({ sectionId, title, children }: { sectionId: string; title: string; children: ReactNode }) {
  return (
    <section
      id={sectionId}
      aria-labelledby={`${sectionId}-title`}
      className="soft-card scroll-mt-24 grid gap-4 p-5 sm:p-7"
    >
      <h2 id={`${sectionId}-title`} className="font-display text-xl font-bold text-ink">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function HelpPage() {
  return (
    <div className="workspace-page max-w-5xl">
      <PageHeader
        title="Тусламж"
        icon="help"
        description="SAT-ийн тухай үндсэн ойлголт, бүртгэлийн дараалал, Монгол дахь шалгалтын төв болон шалгалтын өдрийн бэлтгэлийн мэдээлэл."
      />
      <div className="grid gap-5 text-sm leading-relaxed text-ink-2">
        <nav aria-label="Тусламжийн агуулга" className="flex flex-wrap gap-2">
          {sections.map(({ id, label }) => (
            <a
              key={id}
              href={`#${id}`}
              className="rounded-xl border border-line bg-paper px-4 py-2 font-semibold text-leaf-2 hover:bg-sage"
            >
              {label}
            </a>
          ))}
        </nav>

        <Section sectionId="about" title="SAT гэж юу вэ?">
          <p>
            SAT бол College Board-ийн зохион байгуулдаг, их сургуульд суралцахад шаардлагатай унших, бичих
            болон математикийн чадварыг үнэлэх шалгалт. АНУ болон бусад улсын их сургуулиуд элсэлтийн нэг
            үзүүлэлт болгон ашигладаг. Өгөх шаардлагатай эсэхээ сонирхож буй сургуулийнхаа элсэлтийн нөхцөлөөс
            шалгана.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Reading and Writing', 'Унших ба бичих · 64 минут'],
              ['Math', 'Математик · 70 минут'],
              ['Нийт хугацаа', '2 цаг 14 минут + завсарлага'],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-2xl bg-paper-2 p-4">
                <h3 className="font-bold text-ink">{title}</h3>
                <p>{detail}</p>
              </div>
            ))}
          </div>
          <p>
            Нийт оноо 400–1600; хэсэг тус бүр 200–800 оноотой. Шалгалтыг албан ёсны төвд, Bluebook апп ашиглан
            өгнө. Suuprep нь SAT Math-д бэлдэхэд тусална.
          </p>
          <Source href="https://international.collegeboard.org/toolkit/sat-policy/understanding-sat/format-digital-content-scoring">
            SAT-ийн бүтэц, агуулга, оноо
          </Source>
        </Section>

        <Section sectionId="desmos" title="Desmos гэж юу вэ, яагаад чухал вэ?">
          <p>
            Desmos нь математик илэрхийллийн утгыг тооцоолох, функцийн график байгуулах боломжтой цахим тооны
            машин юм. SAT-ийн математикийн хэсэгт Bluebook дотор суурилагдсан Desmos-ийг ашиглах боломжтой
            бөгөөд график болон шинжлэх ухааны тооны машины горимтой.
          </p>
          <h3 className="font-bold text-ink">SAT Math-д ямар ач холбогдолтой вэ?</h3>
          <ul className="grid list-disc gap-3 pl-5">
            <li>
              <strong className="text-ink">Графикаар ойлгоно.</strong> Шулуун, парабол болон бусад функцийн
              хэлбэр, огтлолцол, тэг болох цэгийг дүрслэн харна.
            </li>
            <li>
              <strong className="text-ink">Бодолтоо шалгана.</strong> Тэгшитгэлийн шийд болон системийн
              огтлолцлыг графикаар харьцуулж, гар аргаар олсон хариугаа нягтална.
            </li>
            <li>
              <strong className="text-ink">Цагийг үр дүнтэй ашиглана.</strong> Тохирох бодлогод тооцоолол,
              графикийн аргыг ашигласнаар олон давтагдах үйлдлийг хялбарчилж болно.
            </li>
          </ul>
          <div className="rounded-2xl bg-paper-2 p-4">
            <h3 className="font-bold text-ink">Жишээ: хоёр шулууны огтлолцол</h3>
            <p className="mt-2">
              Desmos-д y = 2x + 1 болон y = 7 гэж оруулна. Графикуудын огтлолцол (3, 7) тул 2x + 1 = 7
              тэгшитгэлийн шийд x = 3 байна.
            </p>
          </div>
          <p>
            Desmos-ийг үр дүнтэй ашиглахын тулд бодлогын нөхцөлийг зөв тэгшитгэлээр илэрхийлэх, графикийн
            масштаб болон хариуны утгыг тайлбарлах чадвар шаардлагатай. Шалгалтаас өмнө Bluebook-ийн туршилтын
            тестээр хэрэгслийн ажиллагаатай танилцаж, ямар бодлогод ашиглах нь тохиромжтойг дадлагаар
            тодорхойлно.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            <Source href="https://bluebook.collegeboard.org/students/tools">
              Bluebook-ийн тооны машин ба бусад хэрэгсэл
            </Source>
            <Source href="https://help.desmos.com/hc/en-us/articles/30913914831757-Assessment-Resources-FAQ">
              Desmos-ийн шалгалтын хувилбарын мэдээлэл
            </Source>
          </div>
        </Section>

        <Section sectionId="register" title="SAT-д хэрхэн бүртгүүлэх вэ?">
          <ol className="grid list-decimal gap-3 pl-5 marker:font-bold marker:text-leaf-2">
            <li>
              <strong className="text-ink">College Board бүртгэл үүсгэнэ.</strong> Өөрийн имэйл хаягийг
              ашиглаж, нэр болон төрсөн огноогоо шалгалтад авч очих зөвшөөрөгдөх үнэмлэхтэйгээ тааруулан
              оруулна.
            </li>
            <li>
              <strong className="text-ink">My SAT дотор шалгалтын өдрөө сонгоно.</strong> Бүртгэлийн эцсийн
              хугацааг тухайн өдрөөр нь шалгана. Бүх шалгалтын бүртгэл ижил хугацаанд хаагддаггүй.
            </li>
            <li>
              <strong className="text-ink">Улсаа Mongolia гэж сонгож, төвөө хайна.</strong> Байршил, шалгалтын
              өдөр болон сул суудлыг харьцуулж сонгоно.
            </li>
            <li>
              <strong className="text-ink">Мэдээлэл, зураг, төлбөрөө гүйцээнэ.</strong> Зургийн шаардлагыг
              дагаж, төлөх нийт дүнгээ баталгаажуулахын өмнө шалгана. Олон улсын болон нэмэлт үйлчилгээний
              төлбөр байж болно.
            </li>
            <li>
              <strong className="text-ink">Бүртгэлээ баталгаажуулна.</strong> My SAT дахь бүртгэлийн төлөв,
              сонгосон төв, өдрөө дахин шалгаж, баталгаажуулсан имэйлээ хадгална.
            </li>
          </ol>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            <Source href="https://mysat.collegeboard.org/">My SAT-д бүртгүүлэх</Source>
            <Source href={`${official}/sat/registration/online-registration/registering`}>
              Албан ёсны бүртгэлийн заавар
            </Source>
            <Source href={`${official}/sat/dates-deadlines`}>Өдөр ба бүртгэлийн хугацаа</Source>
            <Source href={`${official}/sat/registration/international-testing/fees`}>
              Олон улсын төлбөр
            </Source>
          </div>
        </Section>

        <Section sectionId="centers" title="Монголд SAT хаана өгөх вэ?">
          <p>
            Монгол дахь төвүүдийг шалгалт өгөх өдрөөрөө College Board-ийн{' '}
            <strong className="text-ink">Test Center Search</strong>-ээс хайна. Төв бүр бүх өдөр шалгалт
            авдаггүй; сул суудлыг My SAT-д бүртгүүлэх үедээ баталгаажуулна.
          </p>
          <div className="rounded-2xl bg-sage p-4 text-ink">
            <h3 className="font-bold">Төв хайх дараалал</h3>
            <p className="mt-2">
              Outside the United States → шалгалтын өдөр → Mongolia → Find a Test Center. Төв харагдахгүй бол
              өөр өдрөөр дахин хайна.
            </p>
            <p className="mt-3">
              <Source href={`${official}/sat/test-center-search`}>
                Монгол дахь төвүүд болон сул суудал хайх
              </Source>
            </p>
          </div>
          <article className="rounded-2xl border border-line p-4">
            <h3 className="font-bold text-ink">The British School of Ulaanbaatar</h3>
            <p className="mt-2">
              Тус сургууль 2026–2027 оны хичээлийн жилд SAT-ийн албан ёсны төвөөр ажиллаж байгаагаа мэдээлсэн.
              Бүртгэлийг College Board-оор хийж, боломжтой өдөр болон суудлыг шалгана.
            </p>
            <p className="mt-3">
              <Source href="https://www.britishschool.edu.mn/sat2026">Төвийн албан ёсны мэдээлэл</Source>
            </p>
          </article>
          <p className="text-xs text-ink-3">
            Энэ нь Монгол дахь бүх төвийн жагсаалт биш. Очих хаягаа admission ticket болон бүртгэлийн
            мэдээлэлтэйгээ тулгаж, шалгалтын өмнө төвийн өөрчлөлтийг шалгана.
          </p>
          <Source href={`${official}/sat/test-center-closings`}>Төв хаагдсан эсэхийг шалгах</Source>
        </Section>

        <Section sectionId="test-day" title="Шалгалтын өдөрт хэрхэн бэлдэх вэ?">
          <ul className="grid list-disc gap-3 pl-5">
            <li>
              Bluebook-ийг шалгалт өгөх төхөөрөмждөө урьдчилан суулгаж, төхөөрөмжийн шаардлага хангаж байгааг
              шалгана. Утас ашиглан шалгалт өгөхгүй.
            </li>
            <li>
              Шалгалтаас 1–5 хоногийн өмнө Bluebook-д нэвтэрч exam setup-аа дуусган, admission ticket-ээ авна.
            </li>
            <li>
              Зөвшөөрөгдөх зурагтай үнэмлэх, admission ticket, бүрэн цэнэглэсэн төхөөрөмж, цэнэглэгчээ
              бэлдэнэ. Үнэмлэх дээрх нэр бүртгэлтэй таарах ёстой.
            </li>
            <li>
              Очих цаг, байршлаа тасалбар болон төвийн заавраас шалгана. Замын хугацааг урьдчилан тооцоолно.
            </li>
          </ul>
          <div className="flex flex-wrap gap-x-5 gap-y-3">
            <Source href="https://bluebook.collegeboard.org/students">
              Bluebook ба төхөөрөмжийн шаардлага
            </Source>
            <Source href={`${official}/sat/what-to-bring-do`}>Шалгалтын өдрийн заавар</Source>
            <Source href={`${official}/sat/what-to-bring-do/id-requirements`}>Үнэмлэхийн шаардлага</Source>
          </div>
        </Section>

        <Section sectionId="questions" title="Түгээмэл асуулт">
          <div className="divide-y divide-line">
            {[
              [
                'SAT нь IELTS эсвэл TOEFL мөн үү?',
                'Үгүй. SAT нь унших, бичих болон математикийн чадварыг үнэлнэ. Англи хэлний шалгалт тусад нь шаардах эсэхийг сургуулийнхаа элсэлтийн нөхцөлөөс шалгана.',
              ],
              [
                'Шалгалтын төв дээр очоод бүртгүүлж болох уу?',
                'Бүртгэлийг My SAT-аар онлайнаар хийж, өдөр болон төвөө сонгоно. Төвтэй холбогдсон нь шалгалтад бүртгүүлсэн гэсэн үг биш.',
              ],
              [
                'Миний сонгосон өдөр сул суудал байхгүй бол яах вэ?',
                'Өөр төв эсвэл өөр шалгалтын өдөр хайна. Боломжтой суудлыг My SAT дахь бүртгэлээр баталгаажуулна.',
              ],
              [
                'Тооны машин ашиглаж болох уу?',
                'Математикийн хэсэгт Bluebook доторх Desmos тооны машиныг ашиглаж болно. Өөрийн тооны машин авчрах бол College Board-ийн зөвшөөрөгдөх загварын бодлогыг шалгана.',
              ],
              [
                'Бэлтгэлээ юунаас эхлэх вэ?',
                'Эхлээд Bluebook-ийн бүтэн туршилтын тестээр түвшнээ тодорхойлно. Дараа нь Suuprep-ийн замналаар математикийн сууриа бататгаж, алдсан бодлогуудаа давтана.',
              ],
            ].map(([question, answer]) => (
              <details key={question} className="py-4">
                <summary className="cursor-pointer font-bold text-ink">{question}</summary>
                <p className="mt-3">{answer}</p>
              </details>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={routes.home} className="rounded-xl bg-sage px-4 py-3 font-bold text-leaf-2">
              Математикийн бэлтгэлээ эхлэх
            </Link>
            <Source href={`${official}/sat/what-to-bring-do/calculator-policy`}>Тооны машины бодлого</Source>
          </div>
        </Section>
        <p className="text-xs text-ink-3">
          Эх сурвалж: College Board, Desmos, The British School of Ulaanbaatar. Мэдээллийг шалгасан:
          2026-10-30. Өдөр, төлбөр болон төвийн боломжийг бүртгүүлэхдээ албан ёсны сайтаас дахин шалгана.
        </p>
      </div>
    </div>
  );
}
