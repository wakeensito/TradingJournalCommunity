import { defineConfig, devices } from '@playwright/test';

// Backend-free suite: builds the SPA, serves it with `vite preview` on :4173, and mocks Cognito + every /api route
// (see e2e/mocked/fixtures.ts). Runs locally and in CI with no AWS credentials.
//   npx playwright test -c playwright.mock.config.ts
//   VISUAL_OUT=/tmp/shots npx playwright test -c playwright.mock.config.ts visual   # screenshot every route/sheet
export default defineConfig({
  testDir: './e2e/mocked',
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  webServer: {
    command: 'npx vite build --logLevel error && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:4173',
    timezoneId: 'America/New_York',
    locale: 'en-US',
    trace: 'retain-on-failure',
    // Optional: point at an already-installed Chromium when the bundled build isn't downloaded.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  projects: [
    { name: 'phone-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'phone-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: 'tablet-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
});
