# Suprep

Монгол сурагчдад зориулсан AI SAT Math платформ. Next.js (App Router) · React · TypeScript · Tailwind v4 ·
Supabase · Bun · bun test · Playwright · KaTeX · Gemini (Vertex AI, `@google/genai`). **Бүх код JavaScript/TypeScript.**

Prototype (дизайн): https://claude.ai/artifact/Qa2ruJcMEp3fZ38jzed8AP · Ажлын хуваарь: `Suprep_team_plan.xlsx`

## Эхлэх (нэг удаа)

1. Bun суулгана: `curl -fsSL https://bun.sh/install | bash`
2. `git clone <REPO URL>` → VS Code-оор нээнэ (санал болгож буй extension-уудыг суулгана)
3. `bun install` — `package.json` эсвэл `bun.lock` өөрчлөгдсөн `git pull` бүрийн дараа дахин.
4. `cp .env.example .env.local` (хоосон байж болно)
5. `bun dev` → http://localhost:3000
6. `bun test` → unit/component тест · `bun run check` → lint + type + messages + тест (CI яг үүнийг ажиллуулна)
7. AI хэсэг (H): `bun run ai:build`, тест `bun test ai`.

Supabase-ийн түлхүүргүй үед апп `src/mocks/`-ийн жишээ өгөгдлөөр ажиллана. Gemini-ийн түлхүүргүй үед Суу
«Демо горим»-оор хариулна (`demo: true`).

## Нэвтрэлт (Supabase Auth)

Нүүр (`/`) нь нэвтэрсэн сурагчид газрын зураг, нэвтрээгүй хүнд зөвхөн «Нэвтрэх / Бүртгүүлэх», «Демо сурагчаар
орох» товчтой дэлгэц харуулна. `src/proxy.ts` session-ийг шинэчилж, нэвтрээгүй хүнийг `/` руу буцаана.
Supabase-гүй үед «Демо» нь зөвхөн cookie тавьж, өмнөх шигээ жишээ өгөгдлөөр ажиллана.

Supabase төсөл дээр нэг удаа (Dashboard → Authentication):

1. **Sign In / Providers**: Email (OTP), Google (Client ID/Secret), **Anonymous sign-ins** асаана (демо).
2. **URL Configuration**: Redirect URL-д `http://localhost:3001/auth/callback` ба production домэйн нэмнэ.
3. **Email Templates → Magic Link**: 6 оронтой код ирэхийн тулд `{{ .Token }}`-г загварт оруулна.
4. `supabase/migrations/0007_profile_settings.sql`-г ажиллуулна (шинэ хэрэглэгч бүрт profile мөр үүснэ).

`.env.local`-г git-д хэзээ ч оруулахгүй (`.gitignore`-д бий). Багийнханд хувийн чатаар дамжуулна;
`SUPABASE_SERVICE_ROLE_KEY` бүх RLS-ийг тойрдог тул олон нийтийн суваг руу хэзээ ч бичихгүй.

## Бүтэц

```
src/
  app/                    хуудаснууд (route бүр «Энэ хэсгийг бэлдэж байна» placeholder-той)
    (app)/…               хажуу цэс / доод цэстэй хуудаснууд
    (exam)/mock/          тайван горим (.calm)
    api/tutor/route.ts    Суу (server) — түлхүүр зөвхөн энд
  components/
    ui/                   Button (3D), Pill, Bar, Ring, CountUp, Card, Sheet, Modal, Tilt, EmptyState,
                          Skeleton, toast, SegmentedControl, Switch, ThemeToggle, Confetti
    brand/                CatHead (7 сэтгэл хөдлөл), CatSitting, CatPeek, CatSleeping, Logo, Stars, Blob
    math/                 Tex, Rich ($…$ ба **bold**)
    shell/                AppShell
  features/<хэсэг>/       queries.ts · components/ · lib/ · messages/{mn,en}.json
  lib/                    routes.ts, i18n, theme, time (Asia/Ulaanbaatar), supabase/
  mocks/                  prototype-ийн өгөгдөл (асуулт 31, замнал 5 шат, Desmos 9, карт, badge…)
  server/                 зөвхөн server код (env, tutor)
  test/                   render.tsx (provider-тай), fixtures/, setup.ts
  types/                  Question, Lesson, Card, Mistake, XpEvent … — хэсгүүдийн цорын ганц холбоос
ai/                       H хэсэг: schema, pipeline, train, eval (TypeScript)
e2e/                      Playwright (smoke.spec.ts + <хэсэг>.spec.ts)
supabase/migrations/      DB схем (SQL — Supabase хүснэгт ингэж тодорхойлогддог)
prototype/                prototype-ийн код, зөвхөн лавлагаа
```

| Хэсэг | Хавтас | Хуудас |
|---|---|---|
| A Замнал ба хичээл | `features/journey`, `features/roadmap` | /journey, /lesson/[id], /roadmap, /roadmap/stop/[no], /roadmap/placement, /admin/questions |
| B Desmos Академи | `features/desmos` | /desmos, /desmos/[id] |
| C Дасгал | `features/practice` | /bank, /hard, /practice |
| D Бүтэн тест ба алдаа | `features/exam`, `features/mistakes` | /mock, /mistakes |
| E Карт | `features/cards` | /cards, /cards/[deck], /cards/[deck]/quiz, /cards/mine |
| F XP ба ахиц | `features/progress` | /progress, /achievements, /league |
| G AI багш Суу | `features/tutor`, `server/tutor`, `api/tutor` | /tutor |
| H AI сургалт | `ai/` | — |
| I Нүүр, онбординг, төлөвлөгөө, PWA | `features/home`, `onboarding`, `planner`, `notifications` | /, /onboarding, /dashboard, /planner, /help |

## Монголын аялал (SAT Math roadmap)

26 зогсоол = SAT Math-ийн 26 сэдэв. Эхлээд түвшин тогтоох тест (2 модуль, 35 мин) → түвшин (Сул/Дунд/Сайн)
ба сэдэв бүрийн эзэмшил нь зогсоол бүрийн бодлогын тоо, хүндийг тодорхойлно.

- Тохиргоо: `features/roadmap/{stops,topics,config}.ts` (зогсоолын дараалал, сэдэв, босго, XP).
- Логик (unit тесттэй): `features/roadmap/lib/` — `selectProblems`, placement, unlock, scoring, submit.
- Асуулт: `content/roadmap/<domain>/{questions,placement,intros}.json` — **бүгд анхны (original)**, College
  Board-оос зөвхөн ангилал (domain/skill/difficulty/format) авсан. Production-д зөвхөн `reviewed: true` гарна.
- `bun run roadmap:check-answers` — хариуг тоогоор шалгана · `bun run roadmap:import [-- file.csv] [--dry-run]`
  — JSON/CSV-г шалгаад Supabase руу · `bun run roadmap:map` — газрын зургийг Natural Earth-оос дахин үүсгэнэ.
- Газрын зургийн рельеф: `bun run roadmap:terrain` — AWS Terrain Tiles (өндөршил) ба Natural Earth (нуур)-ыг татаж
  (`scripts/roadmap/.cache`, git-д орохгүй), `public/map/terrain-{1024,2048,3072}.webp`-г дахин bake хийнэ.
  Биомын өнгө, сүүдэр: `scripts/roadmap/terrain.ts`. Чимэглэл (мод, гэр): `features/roadmap/props.ts`.
- DB: `supabase/migrations/0006_roadmap.sql`. Бичилт Server Action → service role (`src/server/db.ts`).
  Админ: `profiles.role = 'admin'` (зөвхөн service role/админ өөрчилнө) → `/admin/questions`.
- Зогсоолын самбар (пин дарахад): газрын нэг мөр `features/roadmap/content/places.ts`, сэдвийн тайлбар, сурах
  зүйлс, томьёо, холбоос (флэш карт, Desmos, хичээл) `features/roadmap/content/guides.ts`. **Бүгд `reviewed: false`
  ноорог — багш хянаж `true` болгоно.** Тест: `content/details.test.ts` (холбоос бүр, KaTeX томьёо бүр шалгагдана).
- `/?demo=states` — картын бүх төлөвийг харуулна (`/roadmap` → `/` руу шилжинэ).

## GitHub: Issue → Branch → Тест → Код → Commit → PR

main руу хэзээ ч шууд push хийхгүй.

1. **Issue**: Title = даалгаврын нэр (`feat(cards): add swipe card`), 2–3 мөр тайлбар, Assignees → өөрийгөө.
2. **Branch**: issue → Development → Create a branch (source: main) → «Checkout locally» командыг ажиллуулна.
3. **Тест эхэлж** (TDD): даалгаврын «Тест» мөрийг `*.test.ts(x)`-д бичээд `bun test` улаан болохыг харна.
   Эхний commit: `test(cards): add swipe card tests`.
4. **Код**: тест ногоон болтол. `bun run check` алдаагүй болтол (формат: `bun run format`).
5. **Commit**: `git add src/features/cards` (өөрийн хавтсаа нэрлэж) → `git commit -m "feat(cards): add swipe card"`.
6. **Push** → GitHub «Compare & pull request».
7. **PR**: Title = commit. Template-ийг бөглөнө (Closes #23, зураг утас + компьютер, тест). Reviewers → ахлагч.
8. CI ногоон болохыг хүлээнэ. Улаан бол засаад push.
9. Merge → `git checkout main && git pull` → дараагийн даалгавар.

Гарчиг: `төрөл(хэсэг): english summary`. Төрөл: feat · fix · test · style · refactor · data · ml.
Хэсэг: journey · desmos · practice · exam · mistakes · cards · progress · tutor · ai · home · onboarding · planner · pwa.
CI буруу гарчигтай PR-ыг улаан болгоно.

Branch шинэчлэх: `git checkout main && git pull && git checkout <branch> && git merge main`.

## Дүрэм

- main руу шууд push, `git push --force`, `git add .` хийхгүй.
- Өөрийн хавтсанд ажиллана. Хэрэгтэй компонентийг `src/features/<хэсэг>/components/`-д нэмнэ.
- `src/components`, `src/types` өөрчлөх бол PR-даа яагаад гэдгээ бичнэ, ахлагч зөвшөөрнө.
- Тестгүй PR merge хийхгүй: логик (`lib/`, `actions.ts`, `queries.ts`) — unit тест; дэлгэц — дор хаяж 1
  component тест (`@/test/render`); гол урсгал — `e2e/<хэсэг>.spec.ts`.
- Шинэ package (`bun add`) нэмэх бол эхлээд хэлнэ (bun.lock conflict).
- Текст `messages/mn.json`, `messages/en.json`-д (хоёуланд ижил түлхүүр — `bun run messages` шалгана).
  Server component: `getT('cards')`, client: `useT('cards')`.
- Өнгийг token class-аар: `bg-paper`, `text-ink-2`, `bg-leaf`, `text-leaf-2`. #hex бичихгүй.
- Хуудас хооронд линк зөвхөн `routes`-оор: `routes.lesson(id)`, `routes.deck(id)`.
- API түлхүүр (Gemini, Supabase service role) хэзээ ч браузерт байхгүй: зөвхөн `.env.local` ба `src/server`.
- Цаг/өдрийн хил `Asia/Ulaanbaatar` (`src/lib/time.ts`).
# SuPrep


## Connecting the existing Suuprep Supabase project

The legacy database keeps its original UUID-based `questions` table. For this project,
set `SUPABASE_QUESTIONS_TABLE=learning_questions` in the ignored `.env.local`, alongside
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
Keep the service key server-side.

`scripts/supabase/prepare-existing-project.ts` generates a compatibility SQL transaction
from the migrations. Review its output before running it in the project SQL editor.
The migration ledger makes repeat runs skip applied migrations. This bootstrap is for
the existing legacy schema; new projects can use the normal migration files.

Run `bun scripts/supabase/check-connection.ts` for read-only table checks.
The optional `--auth` check creates and deletes a temporary test account without sending
email, and verifies onboarding persistence and student access restrictions.

For local email login, allow `http://localhost:3000/auth/callback**` in Auth redirect URLs.
The default email templates send a sign-in link. Public email delivery needs custom
SMTP in Supabase; Google login needs its own provider credentials. Add the production
site URL and callback allow-list entry when deploying.
