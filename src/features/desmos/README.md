# B — Desmos Академи

Implementation of B1–B6 for the existing SuuPrep Next.js app. Based on the prototype source in this repository. This is SuuPrep's own calculator, not the official Desmos API.

## Run

Use the existing dependencies; package.json and bun.lock do not change.

```bash
bun install --frozen-lockfile
bun run dev
```

Open `/desmos`, or `/desmos/d3` for the intersection lesson. Unknown lesson IDs return 404.

## Implementation map

| Requirement | Files | Behavior |
| --- | --- | --- |
| B1 | lib/expr.ts, lib/graph.ts | Safe AST parser, implicit multiplication, powers, functions, π, ≤/≥, points, Mongolian errors, TeX, linear equations solved for y |
| B2 | lib/graph.ts | Roots including double roots, intercepts, extrema, intersections, snapping, numerical equivalence |
| B3 | components/graph-calc.tsx, lib/viewport.ts, lib/use-graph-theme.ts | Canvas grid/axes, explicit curves, inequality regions, implicit curves, points/tables, pan/wheel/pinch, curve selection and POIs, token/theme redraw |
| B4 | components/graph-calc.tsx, lib/table-init.ts | Add/delete/hide rows, Enter, keypad, parameter sliders, editable tables and m/b/R² regression |
| B5 | components/lesson-runner.tsx, lib/step-validator.ts | Nine event-validated step types, hints, equation demo, restart, completion |
| B6 | content/desmos/*.json, content.ts, queries.ts, components/academy-home.tsx | Nine schema-validated lessons, five interactive hacks, academy home |

Content lives inside this feature, consistent with the current repo's B6 query contract. It is not fetched from a database.

## Calculator adapter contract

`GraphCalc` publishes:

- `onState({ rows, parsed, env })` when expressions, tables or sliders change.
- `onPoi({ x, y, kind, rows })` when a point is selected.
- `onView('pan' | 'zoom' | 'home')` for view actions.

The runner uses those callbacks and `validateStep()` rather than DOM clicks. Its optional `GraphApi` exposes `addRow`, `typeRow`, `setSlider`, `focusPoint`, and `getState`. An official API adapter must implement these commands and normalize its state to this model before replacing GraphCalc.

`read` advances only through its CTA; `pan`/`zoom` require their matching view event; `enter` requires an equivalent visible equation; `select` requires the specified POI kind/coordinate; `slider` requires its visible definition and target value; `regression` requires a fitted table; `answer` and `choice` require a correct response. Unrelated events never advance a step.

## Tests

```bash
bun test src/features/desmos
bunx tsc --noEmit -p tsconfig.desmos.json
bun run messages
bunx biome check src/features/desmos 'src/app/(app)/desmos' src/test/setup.ts e2e/desmos.spec.ts playwright.desmos.config.ts tsconfig.desmos.json
bunx playwright install chromium
bunx playwright test --config playwright.desmos.config.ts
```

The dedicated Playwright config runs desktop Chromium and phone emulation. `DESMOS_TEST_PORT` can override port 3000. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` optionally selects a preinstalled browser.

The one-line change in `src/test/setup.ts` makes the existing jest-dom matcher import work with Bun 1.4.4's CommonJS interop. The original default namespace object caused every test to fail before collection. It changes no app behavior and adds no dependency.

UI controls use the feature's mn/en message files, app routes, shared CatHead/Rich/Bar/Pill/Button components, and existing color tokens. Curriculum content remains Mongolian, with English lesson titles and SAT prompts retained from the prototype. Parser errors remain Mongolian as specified.

## Practical limits

- Numerical POI/equivalence checks are not a symbolic CAS proof. Root searches use a finite viewport-related interval and sampling; very close roots or highly oscillatory curves can be missed.
- General implicit curves are drawn, but arbitrary implicit-curve intersections/extrema are not returned as POIs. Explicit functions, vertical lines, and x-only equations cover the included lessons.
- Some general inequalities with variable-dependent coefficients must be rewritten as y=… or x=… first.
- Lesson completion is localStorage-based. Shared server XP/badges/quests are not connected; XP shown on cards is lesson metadata.
- Full production/CI readiness depends on fixing the repository's existing failures. See CHECKS.md in the download package for the observed results. Do not mark the full CI checklist as passing based only on the feature checks.
