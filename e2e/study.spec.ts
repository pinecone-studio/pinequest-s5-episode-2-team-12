import { expect, test } from '@playwright/test';

// Phase 6 in demo mode (localStorage): flashcards with SM-2, the daily challenge, the mistake notebook.

test('flashcards: flip, grade, the queue moves on; topic filter', async ({ page }) => {
  await page.goto('/flashcards');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const left = page.getByText(/^\d+ карт үлдсэн$/);
  await expect(left).toHaveText('10 карт үлдсэн');
  await page.getByRole('button', { name: 'Хариуг харах' }).click();
  await expect(page.getByRole('button', { name: /Зүгээр/ })).toBeVisible();
  await page.getByRole('button', { name: /Зүгээр/ }).click();
  await expect(left).toHaveText('9 карт үлдсэн');
  await page.getByRole('button', { name: 'Хариуг харах' }).click();
  await page.getByRole('button', { name: /Дахин/ }).click();
  // «Дахин» brings the card back in 10 minutes, so it leaves today's queue for now
  await expect(left).toHaveText('8 карт үлдсэн');
  await page.getByRole('combobox', { name: 'Сэдэв' }).selectOption('2');
  await expect(page.getByText('slope').first()).toBeVisible();
});

test('daily challenge: five server-graded problems, then a score; one try per day', async ({ page }) => {
  await page.goto('/daily');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Эхлэх' }).click();
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(`Бодлого ${i} / 5`)).toBeVisible();
    const radios = page.getByRole('radiogroup').getByRole('radio');
    if (await radios.count()) await radios.first().click();
    else await page.getByRole('textbox').fill('1');
    await page.getByRole('button', { name: 'Илгээх' }).click();
    await expect(page.getByText(/^(Зөв!|Буруу\.)/)).toBeVisible();
    await page.getByRole('button', { name: 'Дараах' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Өнөөдрийн сорил дууслаа' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Өнөөдрийн сорил дууслаа' })).toBeVisible();
});

test('mistake notebook: wrong mock answers are saved and can be reviewed', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/mock');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Тест эхлэх' }).click();
  // answer the first three with a likely-wrong value, then finish both modules
  for (let i = 1; i <= 3; i++) {
    await expect(page.getByText(`Бодлого ${i} / 22`, { exact: true }).first()).toBeVisible();
    const radios = page.getByRole('radiogroup').getByRole('radio');
    if (await radios.count()) await radios.nth(3).click();
    else await page.getByRole('textbox').fill('9999');
    await page.getByRole('button', { name: 'Дараах' }).click();
  }
  for (const m of [1, 2]) {
    await page
      .getByRole('navigation', { name: 'Бодлогын жагсаалт' })
      .getByRole('button', { name: /дуусгах/ })
      .click();
    await page.getByRole('button', { name: 'Тийм, дуусгах' }).click();
    if (m === 1) await page.getByRole('button', { name: 'Модуль 2-ыг эхлэх' }).click();
  }
  await expect(page).toHaveURL(/\/profile\/mock\//);
  await page.goto('/mistakes');
  const review = page.getByRole('button', { name: /Давтаж эхлэх \(\d+\)/ });
  await expect(review).toBeEnabled();
  await review.click();
  await expect(page.getByRole('button', { name: 'Шалгах' })).toBeVisible();
  await expect(page.getByRole('radiogroup').or(page.getByRole('textbox')).first()).toBeVisible();
  const radios = page.getByRole('radiogroup').getByRole('radio');
  if (await radios.count()) await radios.first().click();
  else await page.getByRole('textbox').fill('1');
  await page.getByRole('button', { name: 'Шалгах' }).click();
  await expect(page.getByText(/^(Зөв!|Буруу\.)/)).toBeVisible();
  await expect(page.getByText('Тайлбар:')).toBeVisible();
});
