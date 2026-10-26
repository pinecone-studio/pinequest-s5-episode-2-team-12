import { expect, test } from '@playwright/test';

test('sidebar stays open across pages and layouts until explicitly closed', async ({ page }) => {
  await page.goto('/bank');
  await page.getByRole('button', { name: 'Цэс', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Цэс', exact: true });
  await expect(drawer).toBeVisible();

  for (const [label, path] of [
    ['Шинэ үг', '/flashcards'],
    ['Mock тест', '/mock'],
    ['Найзуудтайгаа өрсөлдье', '/friends'],
    ['Аялал (газрын зураг)', '/'],
    ['Асуултын сан', '/bank'],
  ]) {
    await drawer.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  }

  await drawer.getByRole('button', { name: 'Цэс хаах', exact: true }).click();
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Цэс', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});
