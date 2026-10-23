import { expect, test } from '@playwright/test';

// Section I · demo sign-in flow on /login
test.describe('login', () => {
  test('renders without overflow or errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Эргээд тавтай морил' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    expect(errors).toEqual([]);
  });

  test('signs in and lands on the dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Имэйл хаяг').fill('bat.erdene@school.mn');
    await page.getByLabel('Нууц үг', { exact: true }).fill('anything');
    await page.getByRole('button', { name: 'Нэвтрэх', exact: true }).click();
    await expect(page.getByText('Эргээд тавтай морил, Bat')).toBeVisible();
    await page.getByRole('button', { name: /Одоо очих/ }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('shows the demo wrong-password error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Имэйл хаяг').fill('bat@school.mn');
    await page.getByLabel('Нууц үг', { exact: true }).fill('wrongpass');
    await page.getByRole('button', { name: 'Нэвтрэх', exact: true }).click();
    await expect(page.getByText('Имэйл эсвэл нууц үг буруу байна.')).toBeVisible();
  });

  test('?mode=signup opens Create Account', async ({ page }) => {
    await page.goto('/login?mode=signup');
    await expect(page.getByRole('heading', { level: 1, name: 'Бүртгэл үүсгэх' })).toBeVisible();
    await expect(page.getByLabel('Нэр')).toBeVisible();
  });
});
