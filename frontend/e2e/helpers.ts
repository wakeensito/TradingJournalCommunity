import { expect, type Page } from '@playwright/test';

/** Marker put in the note of every trade a test creates, so cleanup only ever touches test data. */
export const E2E_NOTE = 'e2e-run';

interface Cfg {
  region: string;
  clientId: string;
  apiBase: string;
}

/** Direct API client for setup/cleanup (signs in to Cognito from Node; never used for assertions on UI). */
export async function apiClient(baseURL: string) {
  const cfg = (await (await fetch(new URL('/config.json', baseURL))).json()) as Cfg;
  const res = await fetch(`https://cognito-idp.${cfg.region}.amazonaws.com/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth' },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: cfg.clientId,
      AuthParameters: { USERNAME: process.env.E2E_EMAIL, PASSWORD: process.env.E2E_PASSWORD },
    }),
  });
  const auth = (await res.json()) as { AuthenticationResult?: { AccessToken: string } };
  const token = auth.AuthenticationResult?.AccessToken;
  if (!token) throw new Error('E2E API sign-in failed');
  const call = async <T>(method: string, p: string, body?: unknown): Promise<T> => {
    const r = await fetch(new URL(`${cfg.apiBase}${p}`, baseURL), {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`${method} ${p} → ${r.status}`);
    return (await r.json()) as T;
  };
  return {
    bootstrap: () =>
      call<{ trades: { id: string; notes?: string; date: string }[]; days: { date: string }[]; settings: Record<string, unknown> }>('GET', '/bootstrap'),
    deleteTrade: (id: string) => call('DELETE', `/trades/${encodeURIComponent(id)}`),
    putDay: (d: unknown) => call('PUT', `/days/${encodeURIComponent((d as { date: string }).date)}`, d),
    putSettings: (s: unknown) => call('PUT', '/settings', s),
  };
}

export async function deleteTestTrades(baseURL: string) {
  const api = await apiClient(baseURL);
  const { trades } = await api.bootstrap();
  for (const t of trades.filter((x) => x.notes?.includes(E2E_NOTE))) await api.deleteTrade(t.id);
}

export async function openApp(page: Page, route = 'today') {
  await page.goto(`/#/${route}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Wait for bootstrap (skeleton gone).
  await expect(page.locator('[aria-busy="true"][aria-label="Loading"]')).toHaveCount(0);
}

export async function openQuickLog(page: Page) {
  await page.getByRole('button', { name: /^Log a trade/ }).locator('visible=true').first().click();
  await expect(page.getByTestId('quick-log')).toBeVisible();
}

/** Parse '+$1,234.50' / '−$80.00' / '$0.00' into a number. */
export function money(text: string): number {
  const t = text.replace(/\s/g, '');
  const neg = t.startsWith('−') || t.startsWith('-');
  const n = Number(t.replace(/[^0-9.]/g, ''));
  return neg ? -n : n;
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Log a trade through the quick-log sheet; tags it with the e2e note. Returns the previewed net. */
export async function quickLog(
  page: Page,
  o: { symbol: string; side?: 'Long' | 'Short'; qty: number; entry: string; exit: string },
): Promise<number> {
  await openQuickLog(page);
  const sheet = page.getByTestId('quick-log');
  await sheet.locator('#tf-symbol').fill(o.symbol);
  await sheet.getByRole('radio', { name: o.side ?? 'Long' }).click();
  await sheet.getByLabel('Quantity', { exact: true }).fill(String(o.qty));
  await sheet.locator('#tf-entry').fill(o.entry);
  await sheet.locator('#tf-exit').fill(o.exit);
  await sheet.getByRole('button', { name: /^Add details/ }).click();
  await sheet.locator('#tf-notes').fill(E2E_NOTE);
  const preview = money((await sheet.getByTestId('pnl-preview').locator('.text-hero-sm').textContent()) ?? '');
  await sheet.locator('#tf-exit').press('Enter');
  await expect(sheet.getByTestId('quicklog-success')).toBeVisible();
  return preview;
}
