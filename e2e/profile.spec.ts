import { expect, type Page, test } from '@playwright/test';

// Full test flow and the profile (demo mode → localStorage): take two mocks, see them on the profile,
// open a result, compare it with the earlier one.

async function takeMock(page: Page, answerFirst: number) {
  await page.goto('/mock');
  await page.getByRole('button', { name: 'Mock тест эхлэх' }).click();
  for (const mod of [1, 2]) {
    await expect(page.getByRole('heading', { name: `Модуль ${mod} / 2` })).toBeVisible();
    await expect(page.getByRole('timer')).toBeVisible();
    for (let i = 0; i < answerFirst; i++) {
      const radios = page.getByRole('radiogroup').getByRole('radio');
      if (await radios.count()) await radios.first().click();
      else await page.getByRole('textbox').fill('1');
      await page.getByRole('button', { name: 'Дараах' }).click();
    }
    await page
      .getByRole('navigation', { name: 'Бодлогын жагсаалт' })
      .getByRole('button', { name: /дуусгах/ })
      .click();
    await page.getByRole('button', { name: 'Тийм, дуусгах' }).click();
    if (mod === 1) {
      await expect(page.getByRole('heading', { name: 'Завсарлага' })).toBeVisible();
      await page.getByRole('button', { name: 'Модуль 2-ыг эхлэх' }).click();
    }
  }
  await expect(page).toHaveURL(/\/profile\/mock\/local-/);
  await expect(page.getByRole('heading', { name: 'Mock тестийн дүн' })).toBeVisible();
}

test('mock → profile → result → compare', async ({ page }) => {
  test.setTimeout(360_000);
  await page.goto('/mock');
  await page.evaluate(() => localStorage.clear());

  await takeMock(page, 0);
  // the result page shows every question with the right answer and an explanation
  await expect(page.getByText('Тооцоолсон оноо').first()).toBeVisible();
  await expect(page.getByText('Зөв хариу').first()).toBeVisible();
  await expect(page.getByText('Энэ бол Suprep-ийн тооцоолсон оноо', { exact: false })).toBeVisible();

  await takeMock(page, 6);

  // avatar in the top bar → profile
  await page.getByRole('link', { name: 'Профайл', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: 'Mock тестүүд' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Тооцоолсон оноо цаг хугацаагаар' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Чадварын зураглал' })).toBeVisible();

  // newest first: open it and compare with the earlier one
  await page
    .getByRole('link', { name: /Тооцоолсон оноо/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Mock тестийн дүн' })).toBeVisible();
  await page.getByRole('link', { name: 'Өмнөхтэй харьцуулах' }).click();
  await expect(page).toHaveURL(/\/compare\?with=local-/);
  await expect(page.getByRole('heading', { name: 'Өмнөхтэй харьцуулах' })).toBeVisible();
  await expect(page.getByText('Сайжирсан сэдвүүд')).toBeVisible();
  await expect(page.getByRole('img', { name: '4 хэсгийн зураглал' })).toBeVisible();
});

test('profile edits stay in demo mode', async ({ page }) => {
  await page.goto('/profile');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  // «Миний мэдээлэл» has its own «Засах»; the name and aimag are edited in the header card
  await page.locator('.profile-identity').getByRole('button', { name: 'Засах' }).click();
  await page.getByRole('textbox', { name: 'Нэр' }).fill('Тэмүүлэн');
  await page.getByRole('combobox', { name: 'Аймаг / хот' }).selectOption('Хөвсгөл');
  await page.getByRole('radio', { name: 'sky' }).click();
  await page.getByRole('button', { name: 'Хадгалах' }).click();
  await expect(page.getByRole('heading', { name: 'Тэмүүлэн' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Тэмүүлэн' })).toBeVisible();
  await expect(page.getByText(/Хөвсгөл/)).toBeVisible();
});
