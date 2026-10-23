import { expect, type Page, test } from '@playwright/test';

async function enter(page: Page, label: string, text: string) {
  const input = page.getByRole('textbox', { name: label, exact: true });
  await input.fill(text);
  await input.press('Enter');
}

test('drag emits pan; zoom must be a separate action', async ({ page }) => {
  await page.goto('/desmos/d1');
  await page.getByTestId('start-lesson').click();
  await expect(page.getByTestId('lesson-progress')).toHaveText('0/4');
  const canvas = page.getByTestId('graph-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2 + 25, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('lesson-progress')).toHaveText('1/4');
  await page.getByRole('button', { name: 'Анхны байрлал', exact: true }).click();
  await expect(page.getByTestId('lesson-progress')).toHaveText('1/4');
  await page.getByRole('button', { name: 'Томруулах', exact: true }).click();
  await expect(page.getByTestId('lesson-progress')).toHaveText('2/4');
});

test('intersection lesson completes only after selecting (2,5) and answering', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/desmos/d3');
  await page.getByTestId('start-lesson').click();
  await enter(page, 'Илэрхийлэл 1', 'y=2x+1');
  await expect(page.getByTestId('lesson-progress')).toHaveText('1/5');
  await enter(page, 'Илэрхийлэл 2', 'y=-x+7');
  await expect(page.getByTestId('lesson-progress')).toHaveText('2/5');
  await page.getByTestId('read-next').click();
  await expect(page.getByTestId('lesson-progress')).toHaveText('3/5');
  const canvas = page.getByTestId('graph-canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  // Initial world centre is (2,3), scale 32 CSS pixels. Select the first
  // curve at (1,3), then select their common POI at (2,5).
  await canvas.click({ position: { x: box.width / 2 - 32, y: box.height / 2 } });
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 - 64 } });
  await expect(page.getByTestId('lesson-progress')).toHaveText('4/5');
  await page.getByRole('textbox', { name: 'Огтлолцлын цэг', exact: true }).fill('(5,2)');
  await page.getByTestId('check-answer').click();
  await expect(page.getByTestId('lesson-progress')).toHaveText('4/5');
  await page.getByRole('textbox', { name: 'Огтлолцлын цэг', exact: true }).fill('(2,5)');
  await page.getByTestId('check-answer').click();
  await expect(page.getByTestId('lesson-complete')).toBeVisible();
  await expect(page.getByTestId('lesson-progress')).toHaveText('5/5');
  await page.getByRole('button', { name: 'Дахин үзэх', exact: true }).click();
  await expect(page.getByTestId('lesson-progress')).toHaveText('0/5');
  await expect(page.getByRole('button', { name: 'Эхлэх', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('slider changes canvas; regression computes fitted coefficients', async ({ page }) => {
  await page.goto('/desmos/d5');
  await page.getByTestId('start-lesson').click();
  await enter(page, 'Илэрхийлэл 2', 'y=ax+1');
  await page.getByRole('button', { name: 'a', exact: true }).click();
  const canvas = page.getByTestId('graph-canvas');
  const before = await canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  const slider = page.getByRole('slider', { name: 'a слайдер' });
  for (let i = 0; i < 20; i++) await slider.press('ArrowRight');
  await expect(page.getByTestId('lesson-progress')).toHaveText('2/3');
  await expect.poll(() => canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL())).not.toBe(before);
  await page.goto('/desmos/d6');
  await page.getByTestId('start-lesson').click();
  await page.getByTestId('read-next').click();
  await page.getByRole('checkbox', { name: /Шугаман регресс/ }).check();
  await expect(page.getByTestId('lesson-progress')).toHaveText('2/3');
  await expect(page.getByText('R² =')).toContainText('1');
});

test('academy exposes all lessons and five working hacks without horizontal overflow', async ({ page }) => {
  await page.goto('/desmos');
  await expect(page.locator('h1')).toContainText('Академи');
  for (let i = 0; i < 5; i++) await page.locator(`#hack-${i}`).click();
  await expect(page.locator('[id^="dl-d"]')).toHaveCount(9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
