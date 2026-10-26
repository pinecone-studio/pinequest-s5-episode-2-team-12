# Plan: map as home, slim shell, profile / practice / social

Status: **draft for approval** (phase 1). No code has been changed.

## 0. What exploration found (things that change the scope)

| # | Finding | Impact |
|---|---|---|
| F1 | **There is no authentication.** No sign-in/sign-up UI, no `proxy.ts` (Next 16's renamed middleware), so Supabase session cookies are never refreshed (`src/lib/supabase/server.ts` comments assume a middleware that doesn't exist). No `.env.local` locally → the whole app runs in mock/demo mode on `localhost:3001`. | "Logged-in vs logged-out" can't exist until auth is built. I add it to phase 2. |
| F2 | **The countdown bug isn't UTC parsing.** `ExamCountdown.tsx:17` counts to `${date}T08:00:00+08:00` (08:00 Ulaanbaatar, the test start). 23:05 Oct 25 → 08:00 Dec 5 = 40 d 8 h 55 m, which matches what you saw. The zone is hard-coded +08:00, the saved date lives only in `localStorage`, and `profiles.exam_date` is ignored. | Need your call (Q2): count to local midnight or to the 08:00 start. |
| F3 | **Gems don't exist.** The 💎 in the top bar shows **XP** (`AppShell.tsx`, `<Stat icon={<Gem />} value={me.xp}>`). | Gems need a new ledger (phase 7). |
| F4 | **`/mock` is only a timer state machine.** Phases intro → module1 → break → module2 → results show no questions, store no answers, and compute no score. | Mock history, result pages and comparison (§5) need a real mock engine first. |
| F5 | **`/mistakes` is a ComingSoon page**, and `features/mistakes/queries.ts` reads a `mistakes` table that **no migration creates**. | New migration plus auto-capture (phase 6). |
| F6 | **`/league` is a placeholder:** the user is hard-coded at rank #1, it uses hard-coded hex colors instead of tokens, and the `league_rows` view exposes every user's name to every signed-in user with no privacy filter. | Replace it with `/leaderboard` (phase 8). |
| F7 | **Correct answers are public.** The `questions.content` jsonb (answer + explanation) is selectable by anyone (`"reviewed questions are public"`), and the stop player grades on the client. That's fine for solo practice, but it breaks §7 fairness: anyone can query the answer to a duel or daily question. | Split answers into a private `question_keys` table, served only by the server (phase 6, before the daily challenge). |
| F8 | **Content volume.** About 156 stop questions, 39 placement, 31 legacy, 40 word cards and 18 formula cards. A mock needs 44 questions, and the daily challenge burns 5 per day (≈46 days of bank). There are no topic descriptions, subtopics or worked examples beyond `intros.json`. | See Q6. I can draft content with `reviewed: false`, but someone has to review it. |
| F9 | **Most of what §6 asks for already exists:** `/cards` has decks, a Leitner scheduler (`features/cards/lib/leitner.ts`), `card_states`, and `content/cards/{words,formulas}.json` with Mongolian meaning, example and KaTeX. | `/flashcards` = evolve `/cards` (migrate Leitner → SM-2), not a rewrite. |
| F10 | **Baseline:** `tsc` is clean and 366 tests pass, but `biome check` already fails with 22 errors. They come mostly from the uncommitted edits on this branch (`tsconfig.json`, `src/features/progress/*`, `src/lib/{level,levels,streak,badge-rules}.ts`), plus two tutor files. | Q8: whose changes are these, and should I commit or format them before phase 2? |
| F11 | **Reference images are missing.** `docs/design/roadmap/` doesn't exist. I only have the terrain image you pasted in chat. | Please add `mongolia-terrain.png`, `mongolia-map.png`, `tier-roadmap.png`. |
| F12 | `Sheet` (`components/ui/Sheet.tsx` + `useDialog`) already gives a bottom sheet on mobile, a right panel on desktop, Esc and focus handling. The roadmap already has `declutter()` label collision and an affine pan/zoom (`lib/iso.ts`). | Reuse them for the drawer and the stop panel. |

## 1. Route changes

| Route | Becomes |
|---|---|
| `/` | Signed in (or demo) → full-screen map. Signed out → minimal entry: logo, one sentence, «Нэвтрэх / Бүртгүүлэх», «Демо сурагчаар орох». |
| `/dashboard`, `/roadmap` | `redirect('/')` (308 via `next.config.ts` `redirects()`). `?demo=states` is kept as `/?demo=states`. |
| `/roadmap/stop/[no]`, `/roadmap/placement*` | Stay (the players). `routes.ts` helpers are unchanged, so callers don't break. |
| `/login` | **New.** Supabase Auth (Q1). |
| `/profile`, `/profile/mock/[id]`, `/profile/mock/[id]/compare` | **New** (§5). |
| `/progress` | → `/profile` (its content moves there). |
| `/league` | → `/leaderboard`. |
| `/leaderboard`, `/friends`, `/duel/[id]`, `/group/[id]`, `/shop`, `/daily`, `/settings` | **New.** |
| `/flashcards`, `/flashcards/[deck]`, `/admin/flashcards` | **New**, built from `/cards`. `/cards*` redirects there. |
| `/mistakes` | Implement the existing route. |
| `/practice` | Gets the "by topic / difficulty / random set" picker. `/bank` and `/hard` fold into it as tabs, and the old URLs redirect with query params. |
| `/journey` | **Proposal:** merge into the map. Journey lessons are attached to the matching stop as «Товч хичээл үзэх». Lessons with no matching topic are listed under Материал › Хичээлүүд. `/journey` redirects to `/`, and `/lesson/[id]` stays. (Q4) |

The redirects go in `next.config.ts` `redirects()`. The auth gate and session refresh go in `src/proxy.ts`, using the Next 16 convention from `node_modules/next/dist/docs/.../proxy.md`, matched only on app routes.

## 2. Shell

**Delete:** `features/home/components/Dashboard.tsx` (680 lines), `ScoreCard.tsx`, the dashboard page, the sidebar "Бүтэн тест" promo card, the top-bar search, the stats and the bell, the phone bottom tab bar and its "Бусад" sheet, `RoadmapHeader.tsx`, and the full-width placement banner in `RoadmapView`.

**Where the removed things go:**

| Removed | Goes to |
|---|---|
| Search bar | `/practice` (question bank tab). Removed from the top bar. |
| Gems, streak, XP | Profile header (and the drawer's user card shows level + streak). |
| Bell | **Removed.** There is no notification system; it only showed an "empty" toast. |
| Theme switch | `/settings` (also a compact toggle in the drawer footer). |
| Stats, XP ring, streak, badge teaser | Profile. |
| League | Leaderboard. |
| Plan card, score prompt, SAT countdown tile | AI төлөвлөгөө. The countdown also lives in the top-bar chip. |
| Continue card | "Current stop" focus on the map (camera flies there, plus the pulsing pin and its label). |
| Skill grid, topics | The map itself and the profile radar. |
| Tutor promo | Removed (it's a drawer item). |

**New components** (in `components/shell/`):
- `TopBar`: transparent, overlaid on the map. ☰ with `aria-expanded`/`aria-controls`, small logo, `ExamChip`, avatar → `/profile`. On non-map pages the same bar gets a solid background.
- `ExamChip`: "SAT хүртэл: 40 өдөр". Tapping opens a popover with d/h/m, a date picker that offers the official dates (`SAT_DATES`) or a custom date, and saves to `profiles.exam_date` (localStorage in demo).
- `NavDrawer`: built on `Sheet`'s dialog logic (focus trap, Esc, outside click, `inert` background), sliding in from the left. The items are the table in your §2. `lib/nav.ts` is rewritten, and Материал keeps its fold (Desmos Академи, Хичээлүүд, Тусламж).

`AppShell` becomes a thin wrapper (TopBar + NavDrawer + `<main>`). The map page renders edge to edge, and other pages keep the current gutter/max-width.

**Countdown fix:** a pure `examCountdown(date, now, tz)` in `lib/time.ts`, which uses `Intl` to find the UTC instant of the target wall-clock time in `tz`. The default tz is `Asia/Ulaanbaatar`, and a new `profiles.tz` column allows overriding it. Unit tests cover 23:05 → 40 d 0 h 55 m, DST zones, and a passed date.

## 3. Map: recommendation

**Recommendation: build the map image first, and add live 3D as an optional upgrade later. Both come from one scene definition.**

1. `scripts/map/` is a build pipeline. It takes DEM tiles and Natural Earth data and produces a heightmap, a biome-colored texture, slab sides, lakes and borders. It's assembled as a react-three-fiber scene. **Playwright (already a dev dependency) renders that scene headless** and saves:
   - `map-1600.webp` (≈150–250 KB, used for the mobile LCP)
   - `map-3200.webp` (≈700–900 KB, loaded after idle for zooming in)
   - a dark/night variant
   - `map-projection.json` with the screen position of every stop (including its elevation) and of the sampled route curve
2. **The runtime default on every device** is that image with HTML pins, SVG route, labels and clusters on top. Pan, pinch-zoom and fly-to reuse the existing `lib/iso.ts` view math. Clouds are CSS sprites (static under reduced motion).
3. **Live 3D (`three` + `@react-three/fiber` + `drei`)** is a lazy chunk. It loads after idle only on capable devices: WebGL2, no reduced motion, no Save-Data, `deviceMemory ≥ 4`, `hardwareConcurrency ≥ 6`. It uses the same scene, `frameloop="demand"` (no rendering while idle), and the same HTML pin layer (pins are projected each frame). It's off by default behind a setting until it holds 60 fps on a real mid-range Android (Q5).

**Why:** the reference is a fixed-angle illustration, and every interaction you specified (pan, zoom, fly-to, callouts) works the same on a baked image. Live 3D adds parallax and moving clouds, but costs about 230 KB gzip of JS plus GPU work on low-end phones. With the image-first approach, LCP stays under 2.5 s, and the 3D upgrade becomes something we can ship or drop without blocking the release. Map skins (winter/night) become extra baked images, about 1 MB each, fetched only when equipped.

**DEM source:** AWS Terrain Tiles (Terrarium PNG, derived from SRTM/GMTED/ETOPO, open, attribution required) at zoom 6, about 20 tiles. They're easy to decode in Bun with `sharp`, with no GDAL needed. Copernicus GLO-90 is an alternative if you prefer it (more tiles, GeoTIFF).

**Biomes:** colored by rule from elevation + slope + latitude, plus a hand-tuned region mask:
- snow above about 3,500 m (Altai)
- taiga north of about 49.5°N in the mountains
- Khangai forest
- steppe
- Gobi sand south of a smoothed boundary

Lakes (Хөвсгөл, Увс, Хар Ус, Хяргас) come from Natural Earth lakes, and aimag borders reuse the existing `build-map.ts` data.

**Pins:** an SVG red pin component with these states:
- **Current:** pulsing ring (static under reduced motion).
- **Completed:** white ✓ + 1–3 stars.
- **Locked:** muted with a lock.
- **Tested out:** ✓ + «Давсан» chip.

**Labels:**
- priority-ordered `declutter()`, where the current stop is always shown
- labels by zoom tier
- leader-line callouts for the UB and western clusters, with precomputed anchor slots in `map-projection.json` and greedy placement at runtime
- screen-space grid clustering (no library) when zoomed out; clicking a cluster zooms to its bounds

**Route:** a Catmull-Rom curve through the stops, sampled on the terrain at bake time:
- completed segments: bright
- next segment: animated dash
- remaining segments: dim

The «Одоогийн байрлал» button appears, and the camera flies to the current stop on load.

**Bundle cost:**

| Addition | gzip | Loaded |
|---|---|---|
| `three` | ~155 KB | lazy, capable devices only |
| `@react-three/fiber` v9 | ~40 KB | lazy |
| `@react-three/drei` (used parts) | ~20–40 KB | lazy |
| `sharp` | 0 (dev only) | build script |
| Textures | WebP, not KTX2. KTX2 needs a ~200 KB Basis transcoder. | |
| Charts, SM-2, clustering, focus trap | Hand-written, no new libraries | |

## 4. Stop detail panel

This is a new `StopPanel` on `Sheet`: a right panel on desktop and a bottom sheet on mobile.
- **Keyboard:** ←/→ move between stops, Esc closes.
- **Semantics:** `role="dialog"`, labelled by the header.

New config files, all `reviewed: false` until a human checks them:
- `features/roadmap/places.ts`: one line per place.
- `features/roadmap/content/topics/<id>.json`: description, goals, formulas (KaTeX), one worked example, and Desmos tip ids.

What the panel computes:
- **Mastery:** placement mastery blended with recent stop attempts.
- **Best score.**
- **Problem count and difficulty mix:** from the existing `ROADMAP.mix` / `setLength`.
- **Estimated time:** from a new `ROADMAP.minutesPer` by difficulty.
- **XP:** from `ROADMAP.xp`.

The "Related" section lists flashcards with a `topicId`, Desmos lessons mapped to the topic, and mistakes for the topic. A locked stop shows what unlocks it (from `unlock.ts`) and «Урьдчилж харах» (read-only intro).

«Суугаас асуух» opens `routes.tutor({ kind: 'topic', id })`. This adds a `'topic'` context kind to the tutor.

## 5. Profile

**Header:**
- avatar, display name, level, aimag, optional school
- XP, 💎 and streak

**Avatar:** I propose preset avatars (cat variants + shop frames) instead of photo upload, to avoid storing photos of minors (Q7).

**Ranking:** friends, aimag and national × week/all-time, via a `leaderboard_rank` RPC.

**Radar:**

| Cluster | Topics | Domain |
|---|---|---|
| 1. Шугаман тэгшитгэл ба тэнцэтгэл биш | 1, 2, 6 | Algebra |
| 2. Шугаман функц ба систем | 3, 4, 5 | Algebra |
| 3. Харьцаа, хувь, нэгж | 7, 8, 9 | PSDA |
| 4. Өгөгдөл ба магадлал | 10, 11, 12 | PSDA |
| 5. Статистик дүгнэлт | 13, 14 | PSDA |
| 6. Илэрхийлэл ба тэгшитгэл | 15, 16, 17, 18 | Advanced |
| 7. Шугаман бус функц | 19, 20, 21 | Advanced |
| 8. Геометр ба тригонометр | 22–26 | Geo/Trig |

Every cluster sits in one domain, so the 4-domain toggle is a clean roll-up.

**Score per topic:**
- a difficulty-weighted accuracy, with an exponential decay half-life of 14 days
- a Beta(1,1) prior, so 1/1 doesn't show as 100%
- shown as "өгөгдөл хангалтгүй" when fewer than 3 answers

Inputs are `problem_attempts` + mock answers + daily/duel answers. The overlay is the radar as of the last mock.

**Charts:** a hand-written SVG radar + line chart, using tokens for both themes. Each has a visually-hidden data table for screen readers. No library needed, about 4 KB.

**Mock engine (prerequisite, see F4):**
- 2 modules × 22 questions, an adaptive module 2 (same rule as placement), 35 + 35 min and a 10 min break
- questions served one at a time by Server Actions, with server-side timing
- built on the existing `exams` table and `exam-machine.ts`

The score is "тооцоолсон оноо": raw → 200–800 via a conversion table in config, never called official.

**Result page:** every question, your answer, the correct answer, explanation, time spent. **Compare:** pick any earlier attempt and see:
- the score delta
- domain deltas
- both radars overlaid
- improved/worse topics

**Achievements:** recent badges + region badges + a link to `/achievements`.

## 6. Flashcards, mistakes, daily

- **Flashcards:**
  - `/flashcards` with "Үгс" (from `words.json`) and "Томьёо" (from `formulas.json`). A `topicId` is added per card.
  - SM-2 with 4 grades (Дахин/Хэцүү/Зүгээр/Амархан) in `features/cards/lib/sm2.ts`. Existing Leitner boxes migrate to an equivalent interval/ease.
  - daily due count, topic filter, "for the current stop"
  - content is versioned JSON (`version`, `reviewed`)
  - `/admin/flashcards` review page, reusing the `/admin/questions` pattern
- **Mistakes:**
  - every wrong answer is upserted into `mistakes`, from the stop, practice, mock, daily and duel contexts
  - reviewed with SM-2 (same scheduler)
  - filter by topic
- **Daily:**
  - `daily_challenges(date, question_ids)`, picked deterministically, server-side, from the private-key pool
  - one attempt per day
  - score = correct × 100 − time penalty
  - feeds the leaderboard
- **Prerequisite:** the `question_keys` split (F7) lands at the start of this phase.

## 7. Shop and gem economy

- **Ledger:** `gem_events` (user, ±amount, reason, unique key), the same pattern as `xp_events`. The balance is a sum, never a column the client can write. Note that `profiles` RLS lets users write any column, so nothing economic goes on `profiles`.
- **Items:** `shop_items` is seeded from `features/shop/catalog.ts`:
  - streak freeze
  - hint tokens
  - avatar frames
  - cat outfits (SVG overlays on `CatHead`)
  - map skins
  - banners
- **Inventory and purchases:** `inventory(user, item, qty, equipped)`. `purchases(id, user, item, price, idem_key unique)` is written only via a `purchase_item(item, idem_key)` security-definer function. It takes a row lock, checks the balance, inserts the purchase plus a negative gem event plus the inventory row, and returns the existing purchase if the key repeats.
- **Earning** (one config, `features/shop/economy.ts`), starting values open to tuning:

| Source | Gems |
|---|---|
| Stop pass | 5 |
| Each star | +2 |
| Region badge | 20 |
| Daily challenge | 3 |
| 7-day streak | 10 |
| 30-day streak | 40 |
| Mock finished | 15 |

Prices start at 30 (streak freeze) and go to 300 (map skin).

## 8. Social

- **Friends:**
  - `profiles.friend_code` (8 characters, unambiguous alphabet); invite link `/friends/add/<code>`
  - Web Share API, with fallbacks for Messenger (`fb-messenger://share?link=` on mobile, `facebook.com/dialog/send` needs an app id; otherwise copy-link)
  - `friendships(a, b, status, requested_by)` with requests accepted or declined; remove
  - `blocks`
  - `reports(reporter, target, context, reason enum)`
- **Duels (async v1):**
  - `duels` (challenger, opponent, topic | mixed, size 5/10, question_ids frozen at creation, time limit, expires_at = +24 h)
  - `duel_runs` and `duel_answers`
  - questions are served one at a time by the server
  - results are revealed only when both runs are final or the duel expires
- **Group mock:**
  - `group_sessions` (host, form, starts_at, closes_at) + `group_members`
  - everyone gets the same frozen form through the same mock engine
  - the server enforces the timer, with no pause
  - the board appears after `closes_at`
- **Leaderboards:**
  - scope (friends/aimag/national) × metric (weekly XP, daily score, best mock)
  - SQL views + an RPC that exclude privacy-hidden users, blocked users and `flagged` attempts
  - they replace `league_rows`
- **Fairness:**
  - answers never leave the server before submit (F7)
  - per-question `served_at`/`answered_at` is recorded on the server
  - runs over the limit + 5 s grace are rejected
  - runs with a median under about 3 s per question, or other impossible patterns, are flagged
  - flagged runs are hidden from boards
- **Safety:**
  - public view is `public_profiles` (id, name, avatar, level) only
  - interactions are fixed reactions (emoji + «GG», «Сайн тоглолоо»…) from an enum, with no free text
  - privacy settings: hide from national/aimag, friends-only
  - no phone numbers or location beyond aimag
  - block/report menus on every user chip
- **Realtime (later):** the duel schema already has a `mode` column. Live mode would use Supabase Realtime broadcast channels per duel, with the server still authoritative for questions and timing. Not built now.

## 9. Migrations (new files, in order)

| File | What it adds |
|---|---|
| `0007_profile_social_fields.sql` | `profiles` + avatar_id, aimag (check list), school (≤ 60 characters), tz, friend_code, hide_public, friends_only; `public_profiles` view |
| `0008_mistakes.sql` | the table F5 expects |
| `0009_question_keys.sql` | move answer/explain out of public `questions.content` |
| `0010_mock_engine.sql` | extend `exams` (kind, form, score_est, domain_scores, flagged, group_session_id) + `exam_answers` |
| `0011_flashcards_sm2.sql` | `card_states` + ease, interval, reps, lapses; `card_reviews` log |
| `0012_daily.sql` | the daily challenge tables |
| `0013_economy.sql` | `gem_events`, `shop_items`, `inventory`, `purchases`, `purchase_item()` |
| `0014_social.sql` | friendships, blocks, reports, duels*, group_*, reactions, leaderboard views/RPCs |

All of them:
- enable RLS
- write only through Server Actions → service role (existing `server/db.ts` pattern) or security-definer functions
- come with demo-mode fallbacks in `queries.ts` so the app still runs without Supabase

## 10. Phases (yours, with two insertions)

| Phase | Scope | Notes |
|---|---|---|
| 2 | Shell + **auth** (`/login`, `proxy.ts`, Supabase anonymous sign-in for «Демо») + countdown fix + `/settings` | redirects, drawer, top bar, entry screen |
| 3 | Map pipeline, baked image, pins, labels/clusters, route, camera | **3b** live 3D as an optional upgrade, only if you want it after seeing 3a |
| 4 | Stop panel + topic content drafts | |
| 5 | **Mock engine** → profile, radar, history, compare, ranking stub | |
| 6 | `question_keys` → flashcards (SM-2), mistakes, daily | |
| 7 | Economy + shop | |
| 8 | Friends, duels, group mock, leaderboards, privacy/safety | |
| 9 | Polish, accessibility, performance, the 3 E2E flows | |

Each phase ends with `bun run check` (Biome + tsc + messages + tests) and `bun run e2e` for touched flows, then a short summary. Unit tests are written first for the pure logic: countdown, SM-2, radar, mock deltas, purchase idempotency (SQL-level test via a pure TS mirror + a seeded Supabase test if one is available), duel result, ranking.

## 11. Questions for you

1. **Auth method:** email OTP / magic link, Google OAuth, or both? (I recommend both; no phone.) Should «Демо сурагчаар орох» use Supabase anonymous sign-in (a real account that can be upgraded later)?
2. **Countdown target:** local **midnight** of test day (what you described), or **08:00** test start (what the code does today)?
3. **Supabase:** is there a dev project I should use (`.env.local`)? Without one, everything social, economic and on the leaderboard can only be tested in demo mode.
4. **`/journey`:** OK to merge it into the map as described in §1?
5. **3D:** accept image-first with 3D as an optional 3b? Is there a real mid-range Android to measure on?
6. **Content:** should I draft the stop-panel text, more mock/daily questions and flashcard topic links (all `reviewed: false`)? Who reviews them?
7. **Avatar:** preset avatars only (my safety recommendation), or photo upload?
8. **Uncommitted changes** on `feat/roadmap` (progress/level/streak/badge files, tsconfig) fail Biome. Are they yours? Should I commit or format them first, or leave them? I'll work on a new branch `feat/map-home` off the current one unless you say otherwise.
9. **Reference images:** please add the three files to `docs/design/roadmap/`.
