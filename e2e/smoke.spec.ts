import { expect, test } from '@playwright/test';

// Every page exists from day one. Each section adds e2e/<section>.spec.ts for its main flow.
// playwright.config.ts signs every test in as the cookie demo student.
const PAGES = [
  '/',
  '/?demo=states',
  '/journey',
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
  '/tutor',
  '/planner',
  '/help',
  '/onboarding',
  '/settings',
  '/profile',
  '/flashcards',
  '/daily',
  '/friends',
  '/leaderboard',
  '/shop',
];

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('entry screen → demo → map', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Нэвтрэх', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Демо сурагчаар орох' }).click();
    await expect(page.getByRole('application', { name: /газрын зураг/i })).toBeVisible();
  });

  test('app pages send signed-out visitors to the entry screen', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Демо сурагчаар орох' })).toBeVisible();
  });
});

test('old dashboard and roadmap URLs land on the map', async ({ page }) => {
  for (const path of ['/dashboard', '/roadmap']) {
    await page.goto(path);
    await expect(page).toHaveURL(/:\d+\/$/);
  }
  await page.goto('/league');
  await expect(page).toHaveURL(/\/leaderboard$/);
});

for (const path of PAGES) {
  test(`page ${path} renders without overflow`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeAttached();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    expect(errors).toEqual([]);
  });
}

test('drawer opens from ☰, traps focus and closes on Escape', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'desktop uses the rail (e2e/sidebar.spec.ts)');
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Цэс', exact: true });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  const drawer = page.getByRole('dialog', { name: 'Цэс' });
  await expect(drawer).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
  expect(await drawer.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});

test('theme switch in the drawer recolors the page', async ({ page }, info) => {
  await page.goto('/');
  if (info.project.name === 'phone') {
    await page.getByRole('button', { name: 'Цэс', exact: true }).click();
    await page.getByRole('dialog', { name: 'Цэс' }).getByRole('radio', { name: 'Бараан' }).click();
  } else {
    await page.getByRole('button', { name: 'Цэсийг дэлгэх', exact: true }).click();
    await page.getByRole('complementary', { name: 'Цэс' }).getByRole('radio', { name: 'Бараан' }).click();
  }
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('SAT chip shows the countdown and saves a new date', async ({ page }) => {
  await page.goto('/');
  const chip = page.getByRole('button', { name: /^SAT хүртэл/ });
  await chip.click();
  const panel = page.getByRole('dialog', { name: 'SAT хүртэл' });
  await expect(panel.getByText('өдөр', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: '2027.03.06' }).click();
  await expect(panel.getByRole('button', { name: '2027.03.06' })).toHaveAttribute('aria-pressed', 'true');
});
