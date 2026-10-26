import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // every test starts as the cookie demo student; the entry-screen test clears it
  use: {
    baseURL,
    trace: 'on-first-retry',
    storageState: {
      cookies: [
        {
          name: 'suprep-demo',
          value: '1',
          domain: 'localhost',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'bun run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
