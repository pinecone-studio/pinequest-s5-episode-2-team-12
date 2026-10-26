import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Accessibility: no serious or critical axe violations on the main screens, in light and dark themes.
const PAGES = [
  '/',
  '/profile',
  '/flashcards',
  '/mistakes',
  '/daily',
  '/mock',
  '/shop',
  '/friends',
  '/leaderboard',
  '/settings',
  '/login',
];

for (const theme of ['light', 'dark'] as const) {
  for (const path of PAGES) {
    test(`${path} has no serious a11y violations (${theme})`, async ({ page }, info) => {
      test.skip(info.project.name === 'phone' && theme === 'dark', 'dark is covered on desktop');
      await page.addInitScript((t) => localStorage.setItem('suprep-theme', t), theme);
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const { violations } = await new AxeBuilder({ page })
        // the map stage is an interactive canvas (role=application); its decorative layers are aria-hidden
        .exclude('.roadmap-terrain')
        .analyze();
      const bad = violations
        .filter((v) => v.impact === 'serious' || v.impact === 'critical')
        .map(
          (v) =>
            `${v.id}: ${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(' '))
              .join(' | ')}`,
        );
      expect(bad).toEqual([]);
    });
  }
}

test('reduced motion: the frontier ring and the route stop animating', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?demo=states');
  const ring = page.locator('.roadmap-ring').first();
  await expect(ring).toBeAttached();
  expect(await ring.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  const dash = page.locator('.roadmap-dash').first();
  expect(await dash.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});
