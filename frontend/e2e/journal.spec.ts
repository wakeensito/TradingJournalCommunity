import { expect, test } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { E2E_NOTE, apiClient, deleteTestTrades, money, openApp, openQuickLog, quickLog, todayStr } from './helpers';

test.describe.configure({ mode: 'serial' });

test.afterAll(async ({ baseURL }) => {
  await deleteTestTrades(baseURL!);
});

test('sign-in persists across reload', async ({ page }) => {
  await openApp(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in' })).toHaveCount(0);
});

test('quick log MNQ long 2 @ 21000 → 21010.25 shows in Today, Trades and Calendar', async ({ page }) => {
  await openApp(page);
  await openQuickLog(page);
  const sheet = page.getByTestId('quick-log');
  await sheet.locator('#tf-symbol').fill('MNQ');
  await sheet.getByRole('radio', { name: 'Long' }).click();
  await sheet.getByLabel('Quantity', { exact: true }).fill('2');
  await sheet.locator('#tf-entry').fill('21000');
  await sheet.locator('#tf-exit').fill('21010.25');
  const fees = money((await sheet.getByTestId('preview-fees').textContent())!.replace('fees', ''));
  const expected = Math.round((41 - fees) * 100) / 100; // 10.25 pts × 2 contracts × $2
  const preview = money((await sheet.getByTestId('pnl-preview').locator('.text-hero-sm').textContent())!);
  expect(preview).toBeCloseTo(expected, 2);
  await sheet.getByRole('button', { name: /^Add details/ }).click();
  await sheet.locator('#tf-notes').fill(E2E_NOTE);
  await sheet.locator('#tf-entry').press('Enter');
  await expect(sheet.getByTestId('quicklog-success')).toContainText('Logged');
  // Symbol + account kept, prices cleared, sheet still open for the next one.
  await expect(sheet.locator('#tf-symbol')).toHaveValue('MNQ');
  await expect(sheet.locator('#tf-entry')).toHaveValue('');
  await sheet.getByRole('button', { name: 'Done' }).click();

  const row = page.getByTestId('trade-row').filter({ hasText: '21010.25' }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText(`+$${expected.toFixed(2)}`);

  await openApp(page, 'trades');
  await expect(page.getByTestId('trade-row').filter({ hasText: '21010.25' }).first()).toBeVisible();

  await openApp(page, 'calendar');
  const cell = page.locator(`[data-date="${todayStr()}"]`);
  await expect(cell).toHaveAttribute('aria-label', /trade/);
  await cell.click();
  await expect(page.getByTestId('day-sheet').getByTestId('trade-row').filter({ hasText: '21010.25' }).first()).toBeVisible();
});

test('edit a trade, and tag a setup and a mistake', async ({ page }) => {
  await openApp(page);
  await quickLog(page, { symbol: 'MES', qty: 1, entry: '6000', exit: '6002' });
  await page.getByTestId('quick-log').getByRole('button', { name: 'Done' }).click();
  await page.getByTestId('trade-row').filter({ hasText: '6002' }).first().click();
  const sheet = page.getByTestId('trade-sheet');
  await sheet.locator('#tf-exit').fill('6004.5');
  await sheet.locator('fieldset', { hasText: 'Setup' }).getByRole('button').first().click();
  await sheet.locator('fieldset', { hasText: 'Mistakes' }).getByRole('button').first().click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(sheet).toHaveCount(0);
  const row = page.getByTestId('trade-row').filter({ hasText: '6004.5' }).first();
  await expect(row).toBeVisible();
  await expect(row.getByLabel(/mistake tagged/)).toBeVisible();
});

test('close the day', async ({ page, baseURL }) => {
  const api = await apiClient(baseURL!);
  const before = (await api.bootstrap()).days.find((d) => d.date === todayStr());
  try {
    await openApp(page);
    const card = page.locator('section', { has: page.getByRole('heading', { name: /Close the day|Day closed/ }) }).first();
    if (await card.getByRole('button', { name: 'Edit' }).isVisible()) await card.getByRole('button', { name: 'Edit' }).click();
    await card.getByLabel('One line').fill('e2e: stuck to the plan');
    await card.getByRole('radio', { name: 'Yes' }).click();
    await card.getByRole('button', { name: 'Close the day' }).click();
    await expect(card.getByTestId('day-review')).toContainText('stuck to the plan');
    await page.reload();
    await expect(page.getByTestId('day-review')).toContainText('stuck to the plan');
  } finally {
    await api.putDay(before ?? { date: todayStr(), review: {}, updatedAt: new Date().toISOString() });
  }
});

test('import a Tradovate CSV, and re-import is idempotent', async ({ page, baseURL }) => {
  const api = await apiClient(baseURL!);
  const existing = new Set((await api.bootstrap()).trades.map((t) => t.id));
  const fixture = path.join(__dirname, '../src/lib/__fixtures__/tradovate-performance.csv');
  try {
    await openApp(page, 'trades');
    await page.getByRole('button', { name: 'Import CSV' }).click();
    const sheet = page.getByTestId('import-sheet');
    await sheet.getByTestId('import-file').setInputFiles(fixture);
    await expect(sheet.getByTestId('import-summary')).toContainText('trades found');
    const confirm = sheet.getByTestId('import-confirm');
    if (await confirm.isEnabled()) {
      await confirm.click();
      await expect(sheet.getByTestId('import-done')).toBeVisible();
      await sheet.getByRole('button', { name: 'Done' }).click();
    } else {
      await sheet.getByRole('button', { name: 'Close' }).click();
    }
    const countAfterFirst = (await api.bootstrap()).trades.length;

    // Second import: nothing new, nothing duplicated.
    await page.getByRole('button', { name: 'Import CSV' }).click();
    await page.getByTestId('import-sheet').getByTestId('import-file').setInputFiles(fixture);
    await expect(page.getByTestId('import-summary')).toContainText('0 new');
    await expect(page.getByTestId('import-confirm')).toBeDisabled();
    await page.getByTestId('import-sheet').getByRole('button', { name: 'Close' }).click();
    expect((await api.bootstrap()).trades.length).toBe(countAfterFirst);
  } finally {
    for (const t of (await api.bootstrap()).trades) if (!existing.has(t.id) && t.id.startsWith('imp_')) await api.deleteTrade(t.id);
  }
});

test('export downloads CSV and JSON', async ({ page }) => {
  await openApp(page);
  await quickLog(page, { symbol: 'MNQ', qty: 1, entry: '21000', exit: '21001' });
  await page.getByTestId('quick-log').getByRole('button', { name: 'Done' }).click();
  await openApp(page, 'trades');
  await page.getByRole('button', { name: 'Export' }).click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^CSV/ }).click()]);
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^JSON backup/ }).click()]);
  expect(json.suggestedFilename()).toMatch(/\.json$/);
});

test('changing a fee in settings updates the quick-log preview', async ({ page, baseURL }) => {
  const api = await apiClient(baseURL!);
  const original = (await api.bootstrap()).settings;
  try {
    await openApp(page, 'settings');
    await page.getByTestId('fee-MNQ').fill('3.5');
    await page.getByTestId('fees-save').click();
    await expect(page.getByTestId('fees-save')).toBeDisabled();
    await openQuickLog(page);
    const sheet = page.getByTestId('quick-log');
    await sheet.locator('#tf-symbol').fill('MNQ');
    await sheet.getByLabel('Quantity', { exact: true }).fill('2');
    await expect(sheet.getByTestId('preview-fees')).toHaveText('fees $7.00');
  } finally {
    await api.putSettings({ feesPerContract: original.feesPerContract });
  }
});

test('delete a trade', async ({ page }) => {
  await openApp(page);
  await quickLog(page, { symbol: 'MNQ', side: 'Short', qty: 1, entry: '21100', exit: '21090.75' });
  await page.getByTestId('quick-log').getByRole('button', { name: 'Done' }).click();
  const row = page.getByTestId('trade-row').filter({ hasText: '21090.75' }).first();
  await row.click();
  await page.getByTestId('trade-sheet').getByRole('button', { name: 'Delete trade' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByTestId('trade-row').filter({ hasText: '21090.75' })).toHaveCount(0);
});
