import { expect, test } from '@playwright/test';

test('downloaded questions reopen offline, retain checked answers, and queue an attempt', async ({
  page,
  context,
}) => {
  await page.goto('/offline');
  await expect(page.getByRole('heading', { name: 'Офлайн дасгал' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/offline-sw.js');
    await navigator.serviceWorker.ready;
    const question = {
      id: 'offline-test',
      domain: 'alg',
      skill: 'Linear equations',
      difficulty: 1,
      format: 'mcq',
      promptHtml: '<p>What is 1 + 1?</p>',
      choices: [
        { label: 'A', html: '<p>2</p>' },
        { label: 'B', html: '<p>3</p>' },
      ],
      answer: 'A',
      accepted: [],
      explanationHtml: '<p>One plus one is two.</p>',
      text: 'What is 1 + 1?',
    };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('suprep-offline', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('practice');
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('practice', 'readwrite');
        tx.objectStore('practice').put({ questions: [{ question }], attempts: [], owner: null }, 'data');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('What is 1 + 1?')).toBeVisible();
  await page.getByRole('radio').first().click();
  await page.getByRole('button', { name: 'Шалгах', exact: true }).click();
  await expect(page.getByText('One plus one is two.')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          new Promise<number>((resolve) => {
            const request = indexedDB.open('suprep-offline', 1);
            request.onsuccess = () => {
              const read = request.result.transaction('practice').objectStore('practice').get('data');
              read.onsuccess = () => {
                resolve(read.result.attempts.length);
                request.result.close();
              };
            };
          }),
      ),
    )
    .toBe(1);
  await page.reload();
  await expect(page.getByText('One plus one is two.')).toBeVisible();
  await expect(page.getByRole('radio').first()).toBeChecked();
  // Any normal page navigation while disconnected lands on the offline shell.
  await page.goto('/bank');
  await expect(page.getByRole('heading', { name: 'Офлайн дасгал' })).toBeVisible();
  await context.setOffline(false);
});

test('saved word cards open offline and keep their reviews', async ({ page, context }) => {
  await page.goto('/offline/flashcards');
  await expect(page.getByRole('heading', { name: 'Офлайн шинэ үг' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/offline-sw.js');
    await navigator.serviceWorker.ready;
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('suprep-offline', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('practice');
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('practice', 'readwrite');
        tx.objectStore('practice').put(
          {
            saved: true,
            owner: '00000000-0000-4000-8000-000000000001',
            states: {},
            extra: [],
            reviewed: [],
            currentStop: null,
            reviews: [],
          },
          'flashcards',
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await context.setOffline(true);
  // A normal /flashcards navigation while disconnected lands on the offline words shell.
  await page.goto('/flashcards');
  await expect(page.getByRole('heading', { name: 'Офлайн шинэ үг' })).toBeVisible();
  await page.keyboard.press('Space');
  await page.keyboard.press('3');
  await expect(page.getByText('1 давталтыг синк хийхээр хүлээж байна.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 давталтыг синк хийхээр хүлээж байна.')).toBeVisible();
  await context.setOffline(false);
});
