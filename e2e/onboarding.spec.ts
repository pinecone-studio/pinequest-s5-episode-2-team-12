import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });
test('sign-up preview → setup → saved demo profile', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Бүртгүүлэх', exact: true }).click();
  await page.getByRole('button', { name: 'Шинэ гишүүний алхмуудыг демогоор үзэх' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole('textbox', { name: 'Таныг хэн гэж дуудах вэ?' }).fill('Demo Student');
  await page.getByRole('radio', { name: 'Зөвхөн туршилтын тест өгсөн' }).check();
  await page.getByRole('button', { name: 'Үргэлжлүүлэх' }).click();
  await page.getByRole('spinbutton', { name: 'SAT Math-ийн зорилтот оноо', exact: false }).fill('750');
  await page.getByRole('button', { name: 'Үргэлжлүүлэх' }).click();
  await page.getByRole('radio', { name: 'Бага зэрэг мэднэ' }).check();
  await page.getByRole('button', { name: 'Үргэлжлүүлэх' }).click();
  await expect(page.getByRole('heading', { name: 'Бэлэн боллоо!' })).toBeVisible();
  await page.getByRole('button', { name: 'Хадгалаад аяллаа эхлүүлэх' }).click();
  await expect(page).toHaveURL(/:\d+\/$/);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Demo Student' })).toBeVisible();
});
