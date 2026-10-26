import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { QUESTIONS } from '../src/mocks/questions';
import type { Question } from '../src/types';

// Main roadmap flow in demo mode (no Supabase → localStorage):
// placement test → results → stop 1 → pass → stop 2 unlocks.
const read = (path: string) =>
  JSON.parse(readFileSync(new URL(`../content/roadmap/${path}`, import.meta.url), 'utf8'));
const BANK = new Map<string, Question>(
  [
    ...QUESTIONS,
    ...['alg', 'psda', 'adv', 'geo'].flatMap((d) => [
      ...read(`${d}/questions.json`),
      ...read(`${d}/placement.json`),
    ]),
  ].map((q: Question) => [q.id, q]),
);

/** Answers the question on screen correctly, using the stored key. */
async function answerCorrectly(page: Page) {
  const box = page.locator('[data-qid]').first();
  const id = await box.getAttribute('data-qid');
  const q = id ? BANK.get(id) : undefined;
  if (!q) throw new Error(`unknown question ${id}`);
  if (typeof q.answer === 'number') {
    await box.getByRole('radio').nth(q.answer).click();
  } else {
    await box.getByRole('textbox').fill(q.answer[0]);
  }
}

test('placement → results → stop 1 → pass → stop 2 unlocks', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // the roadmap is closed until the placement test
  await page
    .getByRole('region', { name: 'Аялал эхлэхийн өмнө' })
    .getByRole('link', { name: 'Түвшин тогтоох тест өгөх' })
    .click();
  await page.getByRole('button', { name: 'Тест эхлэх' }).click();

  for (const finish of ['Модулийг дуусгах', 'Тестийг дуусгах']) {
    for (let i = 0; i < 13; i++) {
      await answerCorrectly(page);
      await page.getByRole('button', { name: i < 12 ? 'Дараах' : finish }).click();
    }
  }

  await expect(page).toHaveURL(/\/roadmap\/placement\/results$/);
  await expect(page.getByRole('heading', { name: /Таны түвшин: Сайн/ })).toBeVisible();
  await expect(page.getByText('Энэ бол SAT оноо биш', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Аяллаа эхлэх' }).click();

  await expect(page).toHaveURL(/:\d+\/$/);
  await page.getByRole('button', { name: /^1-р зогсоол, Өлгий/ }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Эхлэх' }).click();

  await expect(page).toHaveURL(/\/roadmap\/stop\/1$/);
  // placement got topic 1 right on a medium item → «ok» → 8 problems
  for (let n = 1; n <= 8; n++) {
    await expect(page.getByText(`Бодлого ${n} / 8`).first()).toBeVisible();
    await answerCorrectly(page);
    await page.getByRole('button', { name: 'Шалгах' }).click();
    await expect(page.getByText('Зөв!')).toBeVisible();
    await page.getByRole('button', { name: n < 8 ? 'Дараах' : 'Дүнг харах' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Зогсоол давлаа!' })).toBeVisible();

  await page.getByRole('link', { name: 'Газрын зураг руу' }).click();
  await expect(page.getByRole('button', { name: /^1-р зогсоол, Өлгий, .*дууссан, 3 од$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^2-р зогсоол, Улаангом, .*нээлттэй$/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^3-р зогсоол, Ховд, .*түгжээтэй$/ })).toBeVisible();
});

test('skipping the test opens the roadmap at Дунд with a persistent prompt', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Алгасах', exact: true }).click();
  await expect(page.getByText('Түвшин тогтоох тест өгөөгүй байна')).toBeVisible();
  await expect(page.getByRole('button', { name: /^1-р зогсоол, Өлгий, .*нээлттэй$/ })).toBeVisible();
});

test('the map is keyboard reachable and opens a stop sheet', async ({ page }) => {
  await page.goto('/?demo=states');
  const pin = page.getByRole('button', { name: /^5-р зогсоол, Улиастай/ });
  await pin.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '5-р зогсоол, Улиастай' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: '6-р зогсоол, Мөрөн' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('map → pin → stop panel → start the stop', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Алгасах', exact: true }).click();
  await expect(page.getByRole('application', { name: /газрын зураг/i })).toBeVisible();
  await page.getByRole('button', { name: /^1-р зогсоол, Өлгий/ }).click();
  const panel = page.getByRole('dialog', { name: '1-р зогсоол, Өлгий' });
  await expect(panel.getByText(/казах соёл/)).toBeVisible();
  await expect(panel.getByText('Гол томьёо')).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Суугаас асуух' })).toHaveAttribute(
    'href',
    '/tutor?kind=topic&id=1',
  );
  await panel.getByRole('link', { name: 'Эхлэх' }).click();
  await expect(page).toHaveURL(/\/roadmap\/stop\/1$/);
  await expect(page.getByText(/Бодлого 1 \/ \d+/).first()).toBeVisible();
});

test('a locked stop shows what unlocks it and can be previewed', async ({ page }) => {
  await page.goto('/?demo=states');
  // the current pin bobs, so open it from the keyboard (Playwright waits for a still target to click)
  await page.getByRole('button', { name: /^5-р зогсоол, Улиастай/ }).focus();
  await page.keyboard.press('Enter');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  const panel = page.getByRole('dialog', { name: '9-р зогсоол, Хархорин' });
  await expect(panel.getByText(/дуусгавал нээгдэнэ/)).toBeVisible();
  await expect(panel.getByRole('link', { name: /^(Эхлэх|Үргэлжлүүлэх)$/ })).toHaveCount(0);
  await panel.getByRole('button', { name: 'Урьдчилж харах' }).click();
  await expect(panel.getByText('Гол томьёо')).toBeVisible();
});
