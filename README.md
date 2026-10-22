# SuuPrep (Суу) 🐈‍⬛

**AI-powered, gamified SAT Math learning platform for Mongolian students.**

SuuPrep нь Монгол сурагчдад SAT Math шалгалтад суурь түвшнээс эхлэн шат дараатай бэлтгэхэд туслах боловсролын платформ юм.

Сурагчид англи математик үг хэллэг, үндсэн ойлголт, бодлого ойлгох чадвар, график болон Desmos ашиглах арга барилыг суралцаж, дасгал ажиллан ахицаа хянах боломжтой болохоор төлөвлөгдсөн.

Платформын гол дүр нь **Суу** нэртэй ухаалаг хар муур юм.

## Tech Stack

- Next.js (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Bun
- Supabase (integration foundation)
- Automated testing

**All application code is written in JavaScript/TypeScript.**

## Getting Started

### 1. Requirements

- Git
- Bun
- Code editor (VS Code recommended)

Bun суулгах заавар: https://bun.sh

### 2. Clone Repository

```bash
git clone https://github.com/pinecone-studio/pinequest-s5-episode-2-team-12.git
cd pinequest-s5-episode-2-team-12
```

### 3. Install Dependencies

```bash
bun install
```

### 4. Start Development Server

```bash
bun run dev
```

Browser дээр http://localhost:3000 хаягаар нээнэ.

### 5. Run Checks

```bash
bun run typecheck
bun test
bun run build
```

Pull Request үүсгэхээс өмнө эдгээр шалгалтыг ажиллуулна.

## Project Structure

```text
src/
  app/          Next.js pages, layouts, API routes
  components/   Shared UI components and app shell
  features/     Feature-specific functionality
  lib/          Utilities, routing, integrations
  mocks/        Development and demo data
  server/       Server-only logic and configuration
  test/         Testing utilities
  types/        Shared TypeScript types

supabase/       Database migrations
ai/             Planned AI pipeline documentation
prototype/      Original prototype reference notes
```

## Features and Development Areas

| Section | Feature |
|---|---|
| A | Learning Journey & Lessons |
| B | Desmos Academy |
| C | SAT Math Practice |
| D | Mock Exams & Mistake Review |
| E | Flashcards & Spaced Repetition |
| F | XP, Levels, Streaks & Progress |
| G | AI Tutor — Суу |
| H | AI Data Pipeline & Evaluation |
| I | Home, Onboarding, Planner & PWA |

These sections represent the project's development areas. Not all features are implemented yet.

## Current Implementation Status

### Implemented Foundations

- Next.js application setup
- TypeScript architecture
- Shared UI components
- Application shell and navigation
- Routing and localization foundation
- Mock data
- Supabase integration foundation
- AI Tutor API foundation
- Server-side AI environment configuration
- Automated tests

### In Development

- Interactive SAT Math lessons
- Vocabulary-based learning journey
- Desmos learning activities
- Practice questions and mock exams
- Flashcards and spaced repetition
- XP, levels, streaks and achievements
- Personalized learning progress
- Interactive AI Tutor interface

### Planned AI Development

The AI Tutor currently uses predefined demo responses.

The following are **not yet implemented**:

- Live Gemini model integration
- AI fine-tuning
- Training data pipeline
- Automated AI evaluation
- Personalized AI learning recommendations

The server-side configuration supports future Gemini and Google Cloud integration.

See `ai/README.md` for the proposed AI development architecture.

## Learning Roadmap

SuuPrep-ийн суралцах замнал дараах дарааллаар хөгжүүлэгдэхээр төлөвлөгдсөн.

1. **Math Vocabulary** — SAT Math-д хэрэглэгддэг англи үг хэллэгийг сурах.
2. **Math Foundations** — Математикийн үндсэн ойлголтуудыг эзэмших.
3. **Word Problems** — Англи хэл дээрх бодлогын өгүүлбэрийг ойлгох.
4. **Graphing & Desmos** — График болон тооцоолуур ашиглаж сурах.
5. **SAT Practice** — SAT хэв маягийн бодлого бодох.
6. **Progress & Review** — Алдаагаа давтаж, ахицаа хянах.
7. **AI Tutoring** — Суу AI багшаас хувь хүнд тохирсон тайлбар, зөвлөгөө авах.

## GitHub Workflow

Багийн гишүүд дараах workflow-ийг баримтална.

1. GitHub Issue үүсгэх.
2. Өөрийн feature branch-ийг үүсгэх.
3. Код бичиж, тест хийх.
4. TypeScript, tests болон build шалгах.
5. Commit болон push хийх.
6. Pull Request нээх.
7. Code review хийлгэсний дараа merge хийх.

**Important rules:**

- `main` branch руу шууд push хийхгүй.
- `git push --force` ашиглахгүй.
- Бусдын feature code-ийг зөвшөөрөлгүй өөрчлөхгүй.
- API key болон нууц мэдээллийг GitHub-д оруулахгүй.
- Шинэ feature бүрийг боломжтой бол тесттэй хөгжүүлнэ.

See [CONTRIBUTING.md](CONTRIBUTING.md) for team contribution guidance.

## Prototype

Original interactive design prototype:

https://claude.ai/artifact/Qa2ruJcMEp3fZ38jzed8AP

Prototype нь дизайн, хэрэглэгчийн урсгал болон feature implementation-ийн лавлагаа юм.

Prototype-ийн кодыг production код гэж шууд үзэхгүй. Шаардлагатай хэсгийг тестлэж, төслийн архитектурт нийцүүлэн хөгжүүлнэ.

See [prototype/NOTE.md](prototype/NOTE.md).

## Security

- API credentials must remain server-side.
- Do not commit `.env.local`.
- Never expose Gemini or Supabase service-role credentials in browser code.
- Review third-party data licenses before use.

## Project Status

**Active Development — PineQuest Season 5, Episode 2**

SuuPrep is being developed incrementally by a student team. The current repository provides the application foundation for future learning features and AI integration.