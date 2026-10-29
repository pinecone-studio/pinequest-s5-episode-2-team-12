import { expect, test } from '@playwright/test';

// Phase 8 in demo mode: demo friends stand in for other students.

test('invite a friend → duel → both finish → results', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/friends');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('friend-code')).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // add a friend by code (demo: the next demo friend accepts)
  await page.getByRole('textbox', { name: /Найзын код/ }).fill('abcd-2345');
  await page.getByRole('button', { name: 'Нэмэх', exact: true }).click();
  await expect(page.getByRole('list').getByText('Ану')).toBeVisible();

  // challenge her: 5 mixed problems
  await page.getByRole('combobox', { name: 'Хэнтэй' }).selectOption({ label: 'Ану' });
  await page.getByRole('button', { name: 'Тэмцээн илгээх' }).click();
  await expect(page).toHaveURL(/\/duel\/local-/);
  await page.getByRole('button', { name: 'Эхлэх' }).click();
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByText(`Бодлого ${i} / 5`)).toBeVisible();
    const radios = page.getByRole('radiogroup').getByRole('radio');
    if (await radios.count()) await radios.first().click();
    else await page.getByRole('textbox').fill('1');
    await page.getByRole('button', { name: 'Илгээх' }).click();
  }
  // no right/wrong during the duel; results once both have finished
  await expect(page.getByText(/^(Та яллаа!|Ялагдлаа|Тэнцлээ)/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Бодлогууд' })).toBeVisible();
  await page.getByRole('button', { name: /GG/ }).click();
  await expect(page.getByRole('button', { name: /GG/ })).toHaveAttribute('aria-pressed', 'true');

  // the duel shows up on /friends with its result
  await page.goto('/friends');
  await expect(page.getByRole('link', { name: /Ану.*(Та яллаа!|Ялагдлаа|Тэнцлээ)/ })).toBeVisible();
});

test('leaderboard: scopes and metrics; blocking someone removes them', async ({ page }) => {
  await page.goto('/leaderboard?scope=national&metric=xp_week');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const list = page.getByRole('list', { name: /Улс/ });
  await expect(list.getByText('Билгүүн')).toBeVisible();
  await expect(list.getByText(/\(Та\)/)).toBeVisible();
  await page.getByRole('button', { name: 'Цэс: Билгүүн' }).click();
  await page.getByRole('menuitem', { name: 'Хориглох' }).click();
  await expect(list.getByText('Билгүүн')).toHaveCount(0);
  await page.getByRole('link', { name: 'Найзууд', exact: true }).click();
  await expect(page).toHaveURL(/scope=friends/);
  await expect(page.getByRole('list', { name: /Найзууд/ }).getByText('Сараа')).toBeVisible();
});
