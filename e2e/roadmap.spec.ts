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

  // the roadmap is closed until the placement test: the first stop's «Эхлэх» opens it
  await page.getByRole('region', { name: '1-р зогсоол, Өлгий' }).getByRole('link', { name: 'Эхлэх' }).click();
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
  await page.getByRole('region', { name: '1-р зогсоол, Өлгий' }).getByRole('link', { name: 'Эхлэх' }).click();

  await expect(page).toHaveURL(/\/roadmap\/stop\/1$/);
  // the short lesson comes first; skip to the problems
  await page.getByRole('button', { name: 'Бодлого руу' }).first().click();
  // placement got topic 1 right on a medium item → «ok» → 8 problems
  for (let n = 1; n <= 8; n++) {
    await expect(page.getByRole('region', { name: `Бодлого ${n} / 8` })).toBeVisible();
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

test('before placement every stop is locked and the card starts the placement test', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('application', { name: /газрын зураг/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^1-р зогсоол, Өлгий, .*түгжээтэй$/ })).toBeVisible();
  const card = page.getByRole('region', { name: '1-р зогсоол, Өлгий' });
  await expect(card.getByRole('heading', { name: 'Зэрэг ба язгуур' })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Эхлэх' })).toHaveAttribute('href', '/roadmap/placement');
});

test('the map is keyboard reachable and its pins switch the topic card', async ({ page }) => {
  await page.goto('/?demo=states');
  await page.getByRole('button', { name: /^6-р зогсоол, Мөрөн/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: '6-р зогсоол, Мөрөн' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('region', { name: '7-р зогсоол, Цэцэрлэг' })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('region', { name: '6-р зогсоол, Мөрөн' })).toBeVisible();
});

test('another pin shows its card; the current pin starts', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // pins bob, so open them from the keyboard (Playwright waits for a still target to click)
  await page.getByRole('button', { name: /^2-р зогсоол, Улаангом/ }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page
      .getByRole('region', { name: '2-р зогсоол, Улаангом' })
      .getByRole('heading', { name: 'Алгебрын илэрхийлэл' }),
  ).toBeVisible();
  // the current pin first brings its own card back, then does what its «Эхлэх» does
  const current = page.getByRole('button', { name: /^1-р зогсоол, Өлгий/ });
  await current.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: '1-р зогсоол, Өлгий' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/roadmap\/placement$/);
});

test('a locked stop cannot be started', async ({ page }) => {
  await page.goto('/?demo=states');
  await page.getByRole('button', { name: /^9-р зогсоол, Хархорин/ }).focus();
  await page.keyboard.press('Enter');
  const card = page.getByRole('region', { name: '9-р зогсоол, Хархорин' });
  await expect(card.getByRole('button', { name: 'Эхлэх' })).toBeDisabled();
  await expect(card.getByRole('link', { name: 'Эхлэх' })).toHaveCount(0);
});

test('exiting placement restores the topic and a fully visible card', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const prompt = page.getByRole('region', { name: '1-р зогсоол, Өлгий' });
  await prompt.getByRole('link', { name: 'Эхлэх' }).click();
  await expect(page).toHaveURL(/\/roadmap\/placement$/);
  await page.goBack();
  await expect(page.locator('.roadmap-featured-topic h2')).toHaveText('Зэрэг ба язгуур');
  await expect(prompt).toBeVisible();
  // A shadow alone can look visible: verify the prompt is actually above the map background.
  await expect(async () => {
    const onTop = await prompt.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    });
    expect(onTop).toBe(true);
  }).toPass();
});
