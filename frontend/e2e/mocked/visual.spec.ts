// Screenshot every route and sheet in both themes for a human (or agent) visual pass.
// Skipped unless VISUAL_OUT is set:  VISUAL_OUT=/tmp/shots npx playwright test -c playwright.mock.config.ts visual
import path from 'node:path';
import { test, type Page } from '@playwright/test';
import { mockBackend, signIn, todayStr } from './fixtures';

const OUT = process.env.VISUAL_OUT;
const FIXTURE_CSV = path.resolve('src/lib/__fixtures__/tradovate-performance.csv');

test.skip(!OUT, 'Set VISUAL_OUT to capture screenshots');

async function shot(page: Page, name: string, full = false) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${test.info().project.name}-${name}.png`, fullPage: full });
}

async function open(page: Page, route: string) {
  await page.goto(`/#/${route}`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.locator('[aria-busy="true"][aria-label="Loading"]').waitFor({ state: 'detached' });
  await page.waitForTimeout(400);
}

for (const theme of ['dark', 'light'] as const) {
  test(`visual ${theme}`, async ({ page }) => {
    test.setTimeout(120_000);
    await mockBackend(page);
    await signIn(page, theme);
    const t = theme[0];

    for (const r of ['today', 'calendar', 'trades', 'insights', 'settings']) {
      await open(page, r);
      await shot(page, `${t}-${r}`, true);
    }

    // Insights: deeper stats + coach answer.
    await open(page, 'insights');
    await page.getByRole('button', { name: /Deeper stats/ }).click();
    await page.getByRole('button', { name: 'Review my week' }).click();
    await page.getByText('Next week:').waitFor();
    await shot(page, `${t}-insights-open`, true);

    // Quick log: empty, filled, success.
    await open(page, 'today');
    await page.keyboard.press('n');
    const ql = page.getByTestId('quick-log');
    await ql.waitFor();
    await shot(page, `${t}-ql-empty`);
    await ql.locator('#tf-entry').fill('21000');
    await ql.locator('#tf-exit').fill('21012.25');
    await shot(page, `${t}-ql-filled`);
    await ql.getByRole('button', { name: /^Add details/ }).click();
    await shot(page, `${t}-ql-details`);
    await ql.locator('#tf-exit').press('Enter');
    await ql.getByTestId('quicklog-success').waitFor();
    await shot(page, `${t}-ql-success`);
    await page.keyboard.press('Escape');

    // Trade sheet with chart (the morning's first fixture trade, not the one just logged).
    await page.getByTestId('trade-row').last().click();
    await page.getByTestId('trade-sheet').locator('figure svg').waitFor();
    await shot(page, `${t}-trade`);
    await page.keyboard.press('Escape');

    // Day sheet (today, from the calendar).
    await open(page, 'calendar');
    await page.locator(`[data-date="${todayStr()}"]`).click();
    await page.getByTestId('day-sheet').waitFor();
    await shot(page, `${t}-day`);
    await page.keyboard.press('Escape');

    // Import preview.
    await open(page, 'trades');
    await page.getByRole('button', { name: 'Import CSV' }).click();
    await page.getByTestId('import-file').setInputFiles(FIXTURE_CSV);
    await page.getByTestId('import-summary').waitFor();
    await shot(page, `${t}-import`);
    await page.keyboard.press('Escape');

    // Settings: account sheet.
    await open(page, 'settings');
    await page.getByRole('button', { name: /Apex 50K/ }).first().click();
    await shot(page, `${t}-account`);
  });
}

test('visual empty + market down', async ({ page }) => {
  await mockBackend(page, { empty: true, marketDown: true });
  await signIn(page, 'dark');
  for (const r of ['today', 'calendar', 'trades', 'insights']) {
    await open(page, r);
    await shot(page, `empty-${r}`, true);
  }
  await page.keyboard.press('n');
  await page.getByTestId('quick-log').waitFor();
  await shot(page, 'empty-ql');
});
