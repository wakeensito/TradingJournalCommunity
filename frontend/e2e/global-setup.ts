import { chromium, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/** Sign in once through the real UI and save storage (the refresh token lives in localStorage). */
export default async function globalSetup(config: FullConfig) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) throw new Error('Set E2E_EMAIL and E2E_PASSWORD (a dedicated test user).');
  const baseURL = config.projects[0]!.use.baseURL!;
  const out = path.join(__dirname, '.auth', 'state.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL + '/#/today');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('heading', { name: 'Today', level: 1 }).waitFor({ timeout: 20_000 });
  await page.context().storageState({ path: out });
  await browser.close();
}
