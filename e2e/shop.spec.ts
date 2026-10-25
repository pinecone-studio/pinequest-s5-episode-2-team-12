import { expect, test } from '@playwright/test';

// Shop in demo mode: gems come from local progress (10 stops with 3 stars + the west region = 130 💎).
const seeded = () => {
  const stops = Array.from({ length: 26 }, (_, i) => ({
    no: i + 1,
    best: i < 10 ? 1 : 0,
    stars: i < 10 ? 3 : 0,
    attempts: i < 10 ? 1 : 0,
    testedOut: false,
    completedAt: i < 10 ? '2026-10-20T00:00:00.000Z' : null,
  }));
  return {
    state: {
      placement: {
        skipped: true,
        module2: null,
        score: 0,
        level: 'mid',
        mastery: {},
        answers: [],
        finishedAt: '2026-10-19T00:00:00.000Z',
      },
      mastery: {},
      level: 'mid',
      stops,
      regionsDone: ['west'],
    },
    history: [],
    xp: 0,
    badges: [],
  };
};

test('earn → buy → equip, and a purchase is never charged twice', async ({ page }) => {
  await page.goto('/shop');
  await page.evaluate((s) => {
    localStorage.clear();
    localStorage.setItem('suprep:roadmap:v1', JSON.stringify(s));
  }, seeded());
  await page.reload();
  const balance = page.getByTestId('gem-balance');
  await expect(balance).toHaveText('130');

  await page.getByRole('button', { name: /^Авах: Алтан хүрээ/ }).click();
  await page.getByRole('button', { name: 'Тийм, авах' }).click();
  await expect(balance).toHaveText('50');
  await page.getByRole('button', { name: 'Зүүх' }).first().click();
  await expect(page.getByText('Зүүсэн').first()).toBeVisible();

  // too expensive now: the map skin (300) cannot be bought
  await expect(page.getByRole('button', { name: /^Авах: Өвлийн газрын зураг/ })).toBeDisabled();

  await page.reload();
  await expect(balance).toHaveText('50');
  await expect(page.getByText('Зүүсэн').first()).toBeVisible();
});
