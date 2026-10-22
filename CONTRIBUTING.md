# Contributing to SuuPrep

SuuPrep нь багийн хамтын хөгжүүлэлтийн төсөл юм. Кодын чанар, тогтвортой байдлыг хадгалахын тулд дараах дүрмийг мөрдөнө.

## Development Workflow

1. GitHub дээр Issue үүсгэж, хийх ажлаа тодорхойлно.
2. `main` branch-ийн хамгийн сүүлийн хувилбараас шинэ feature branch үүсгэнэ.
3. Өөрийн хариуцсан feature дээр ажиллана.
4. Кодын өөрчлөлтөд тохирох тест бичнэ.
5. TypeScript, unit tests болон production build шалгана.
6. Өөрийн branch руу push хийнэ.
7. GitHub дээр Pull Request нээнэ.
8. Review хийлгэж, зөвшөөрөгдсөний дараа merge хийнэ.

## Branch Naming

Examples:

- `feat/cards`
- `feat/learning-journey`
- `feat/desmos-academy`
- `fix/tutor-api`
- `docs/project-documentation`

## Commit Messages

Format: `type(scope): short description`

Examples:

- `feat(cards): add flashcard component`
- `fix(tutor): handle invalid requests`
- `test(progress): add xp calculation tests`
- `docs: update project documentation`

## Before Opening a Pull Request

Run:

```bash
bun run typecheck
bun test
bun run build
```

Fix any errors before requesting review.

## Team Rules

- Never push directly to `main`.
- Do not use `git push --force` on shared branches.
- Avoid changing teammates' files without coordination.
- Keep API keys and credentials out of Git.
- Write tests for new logic where practical.
- Explain significant architectural changes in your PR.
- Review changes before merging.

## Code Organization

- `src/features/` — Feature-specific code
- `src/components/` — Shared UI components
- `src/types/` — Shared TypeScript types
- `src/server/` — Server-side functionality
- `src/mocks/` — Development data

Coordinate shared component and type changes with the team to avoid conflicts.

## Pull Request Guidelines

Each PR should include:

- A clear title
- Summary of changes
- Testing results
- Related issue, when applicable
- Screenshots for UI changes, when applicable

Keep pull requests focused and reasonably small.