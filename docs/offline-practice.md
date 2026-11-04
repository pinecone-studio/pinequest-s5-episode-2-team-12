# Offline practice

The official question bank includes “Download this page for offline”. Each download adds the ten questions currently displayed to the browser’s collection, including embedded images, answers, and explanations. Image downloads must succeed before the collection is updated. Inline SVG/MathML is stored with the question.

Students open `/offline` in the same browser to practise. The standalone public shell contains no account information. Downloaded questions and checked answers are stored in IndexedDB; submitted attempts use UUIDs and are committed in the same transaction as local progress. Topic, difficulty and text filters run locally. Unchecked drafts are not persisted. Removing downloads keeps attempt history and pending sync records. Downloads are shared within a browser profile; browser storage clearing/eviction removes them.

## «Шинэ үг» (word cards)

`/flashcards` has “Save words for offline”. It stores every bundled card, the admin-written cards, and the student's review progress in the same IndexedDB database (key `flashcards`). After the first save, each online visit refreshes that copy unless offline reviews are still waiting to sync. Students review at `/offline/flashcards`, and opening `/flashcards` without a connection lands there too. Each grade made offline gets a UUID and is replayed in time order by `/api/offline/flashcards`. `offline_card_reviews` makes retries idempotent, and replayed grades award the usual daily card XP. Demo users keep their progress in localStorage only.

A narrowly scoped service worker caches `/offline`, `/offline/flashcards` and immutable Next assets/fonts. Normal navigation falls back to that shell when the network fails. It never caches account pages, authentication responses, or APIs. Installing the website is unnecessary. Production requires HTTPS (localhost also works).

## Deployment

1. Apply `supabase/migrations/0020_offline_practice.sql` and `0021_offline_flashcards.sql` using the normal Supabase migration workflow.
2. Build and deploy the website, including `public/offline-sw.js`.
3. Connect once, download a bank page, open `/offline`, disconnect, reload, check an answer, and reload again.
4. Reconnect with the account used to download. Confirm rows in `offline_question_attempts` appear once, even after retrying requests.

Account attempts sync on connection restoration and page startup; the offline screen retries every 30 seconds. Sync waits for the original account, validates input and regrades against the database. Demo attempts remain local. The new history table is separate from existing roadmap XP/statistics; offline attempts do not award XP. AI tutoring requires connectivity.

Run `bunx playwright test e2e/offline.spec.ts --project=desktop` to check cached navigation and answer persistence in Chromium. Use a production build for release validation; Next development assets can change during hot reload.
