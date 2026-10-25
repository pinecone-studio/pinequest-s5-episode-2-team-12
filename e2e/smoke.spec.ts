import { expect, test } from '@playwright/test';

// Every page exists from day one. Each section adds e2e/<section>.spec.ts for its main flow.
const PAGES = [
  '/dashboard',
  '/journey',
  '/roadmap',
  '/roadmap?demo=states',
  '/roadmap/placement',
  '/roadmap/placement/results',
  '/roadmap/stop/1',
  '/admin/questions',
  '/lesson/s1-l3',
  '/desmos',
  '/desmos/d3',
  '/bank',
  '/hard',
  '/practice',
  '/mock',
  '/mistakes',
  '/cards',
  '/cards/ops',
  '/cards/ops/quiz',
  '/cards/mine',
  '/progress',
  '/achievements',
  '/league',
  '/tutor',
  '/planner',
  '/help',
  '/onboarding',
];

test('landing links into the app', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Демо сурагчаар орох' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

for (const path of PAGES) {
  test(`page ${path} renders without overflow`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    expect(errors).toEqual([]);
  });
}

test('theme switch recolors the page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'toggle lives in the sidebar on desktop');
  await page.goto('/dashboard');
  await page.getByRole('radio', { name: 'Бараан' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
