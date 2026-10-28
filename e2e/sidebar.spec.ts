import { expect, test } from '@playwright/test';

test('phone: the ☰ drawer closes once a page is chosen', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'desktop uses the rail');
  await page.goto('/bank');
  const menu = page.getByRole('button', { name: 'Цэс', exact: true });
  const drawer = page.getByRole('dialog', { name: 'Цэс', exact: true });

  for (const [label, path] of [
    ['Шинэ үг', '/flashcards'],
    ['Mock тест', '/mock'],
    ['Хичээлүүд', '/'],
    ['Асуултын сан', '/bank'],
  ]) {
    await menu.click();
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(drawer).not.toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'false');
  }

  await menu.click();
  await drawer.getByRole('button', { name: 'Цэс хаах', exact: true }).click();
  await expect(drawer).not.toBeVisible();
});

test('desktop: the rail stays on screen, widens, and narrows again once a page is chosen', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'phone', 'phones use the ☰ drawer');
  await page.goto('/bank');
  const rail = page.getByRole('complementary', { name: 'Цэс', exact: true });
  await expect(rail).toBeVisible();
  await expect(page.getByRole('button', { name: 'Цэс', exact: true })).toBeHidden();
  const narrow = (await rail.boundingBox())?.width ?? 0;
  const width = async () => (await rail.boundingBox())?.width ?? 0;

  for (const [label, path] of [
    ['Шинэ үг', '/flashcards'],
    ['Хичээлүүд', '/'],
    ['Асуултын сан', '/bank'],
  ]) {
    await page.getByRole('button', { name: 'Цэсийг дэлгэх', exact: true }).click();
    await expect.poll(width).toBeGreaterThan(narrow + 150);
    await rail.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(rail.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect.poll(width).toBeLessThan(narrow + 10);
  }

  await page.getByRole('button', { name: 'Цэсийг дэлгэх', exact: true }).click();
  await page.getByRole('button', { name: 'Цэсийг хураах', exact: true }).click();
  await expect.poll(width).toBeLessThan(narrow + 10);
  await expect(rail.getByRole('link', { name: 'Асуултын сан', exact: true })).toBeVisible();
});
