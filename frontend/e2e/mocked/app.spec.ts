// Backend-free checks: layout at every width, touch targets, and "no dead buttons".
//   npx playwright test -c playwright.mock.config.ts
import { expect, test, type Page } from '@playwright/test';
import { mockBackend, signIn } from './fixtures';

const ROUTES = ['today', 'calendar', 'trades', 'insights', 'settings'] as const;

async function open(page: Page, route: string) {
  await page.goto(`/#/${route}`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.locator('[aria-busy="true"][aria-label="Loading"]').waitFor({ state: 'detached' });
  await page.waitForTimeout(250);
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  return errors;
}

/** Interactive elements whose box (incl. an ::after hit-area extension) is under 44×44, or that sit off-screen. */
async function auditTargets(page: Page, scope = 'body', minTarget = 44) {
  return page.evaluate(
    ({ scope, minTarget }) => {
      const root = document.querySelector(scope) ?? document.body;
      const small: string[] = [];
      const off: string[] = [];
      const name = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? el.getAttribute('placeholder') ?? el.id ?? '').trim().slice(0, 40);
      for (const el of root.querySelectorAll<HTMLElement>('button, a[href], input:not([type=hidden]):not([type=file]), textarea, select, [role=radio]')) {
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none' || el.closest('[aria-hidden="true"]') || el.hidden) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (!el.closest('.scroll-x, .overflow-auto, .overflow-x-auto') && (r.left < -0.5 || r.right > window.innerWidth + 0.5)) {
          off.push(`${el.tagName.toLowerCase()} "${name(el)}" ${Math.round(r.left)}–${Math.round(r.right)}`);
        }
        if (minTarget) {
          const a = getComputedStyle(el, '::after');
          let w = r.width;
          let h = r.height;
          if (a.content !== 'none' && a.position === 'absolute') {
            const px = (v: string) => (v.endsWith('px') ? parseFloat(v) : 0);
            h = Math.max(h, h - px(a.top) - px(a.bottom));
            w = Math.max(w, w - px(a.left) - px(a.right));
          }
          // Inline text links inside prose are exempt (WCAG 2.5.8 inline exception).
          const inline = el.tagName === 'A' && s.display === 'inline';
          if (!inline && (w < minTarget - 0.5 || h < minTarget - 0.5)) small.push(`${el.tagName.toLowerCase()} "${name(el)}" ${Math.round(w)}×${Math.round(h)}`);
        }
      }
      return { small, off, overflow: document.documentElement.scrollWidth > window.innerWidth ? document.documentElement.scrollWidth : 0 };
    },
    { scope, minTarget },
  );
}

for (const theme of ['dark', 'light'] as const) {
  for (const route of ROUTES) {
    test(`layout ${theme}: ${route} — no overflow, nothing off-screen, 44px targets on touch`, async ({ page, isMobile }) => {
      const errors = watchErrors(page);
      await mockBackend(page);
      await signIn(page, theme);
      await open(page, route);
      const a = await auditTargets(page, 'body', isMobile ? 44 : 0);
      expect(a.overflow, 'horizontal page overflow').toBe(0);
      expect(a.off).toEqual([]);
      expect(a.small).toEqual([]);

      if (isMobile) {
        const bar = page.getByTestId('tabbar');
        await expect(bar).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(100);
        const barTop = (await bar.boundingBox())!.y;
        const lastBottom = await page.evaluate(() => {
          const kids = [...document.querySelectorAll('main section, main ul, main .card')];
          return Math.max(0, ...kids.map((k) => k.getBoundingClientRect().bottom));
        });
        expect(lastBottom, 'content hidden behind the tab bar').toBeLessThanOrEqual(barTop + 1);
      }
      expect(errors).toEqual([]);
    });
  }
}

test('quick log: targets, alignment, and the 6-step happy path', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  await mockBackend(page);
  await signIn(page);
  await open(page, 'today');
  await page.getByRole('button', { name: /^Log a trade/ }).locator('visible=true').first().click(); // 1. open
  const ql = page.getByTestId('quick-log');
  await expect(ql).toBeVisible();
  await page.waitForTimeout(350); // let the sheet finish sliding in before measuring
  const a = await auditTargets(page, '[data-testid="quick-log"]', isMobile ? 44 : 0);
  expect(a.off).toEqual([]);
  expect(a.small).toEqual([]);

  // Segmented control and stepper share a row: centres must line up.
  const seg = (await ql.getByRole('radiogroup', { name: 'Side' }).boundingBox())!;
  const step = (await ql.locator('#tf-qty').boundingBox())!;
  expect(Math.abs(seg.y + seg.height / 2 - (step.y + step.height / 2))).toBeLessThanOrEqual(1);
  // Chips row and the symbol field share a row too.
  const chip = (await ql.getByRole('group', { name: 'Recent symbols' }).getByRole('button').first().boundingBox())!;
  const sym = (await ql.locator('#tf-symbol').boundingBox())!;
  expect(Math.abs(chip.y + chip.height / 2 - (sym.y + sym.height / 2))).toBeLessThanOrEqual(1);

  await ql.getByRole('group', { name: 'Recent symbols' }).getByRole('button', { name: 'MES' }).click(); // 2. symbol
  await ql.getByRole('radio', { name: 'Short' }).click(); // 3. side
  await ql.getByRole('button', { name: 'Increase Quantity' }).click(); // 4. qty
  await ql.locator('#tf-entry').fill('5810.25'); // 5. entry
  await ql.locator('#tf-exit').fill('5806'); // 6. exit
  await ql.locator('#tf-exit').press('Enter'); // save
  await expect(ql.getByTestId('quicklog-success')).toBeVisible();
  await expect(ql.getByTestId('quicklog-success')).toContainText('+$40.02'); // (5810.25−5806)×2×$5 − 2×$1.24
  expect(errors).toEqual([]);
});

test('market context: strip, chart, plan events; and it hides quietly when the market API is down', async ({ page }) => {
  await mockBackend(page);
  await signIn(page);
  await open(page, 'today');
  await expect(page.getByRole('group', { name: 'Market context (times ET)' })).toBeVisible();
  await page.getByRole('button', { name: /^Pre-market plan/ }).click();
  await page.getByRole('button', { name: 'Add today’s events' }).click();
  await expect(page.locator('[id^="pl-focus-"]')).toHaveValue(/8:30 CPI m\/m \(high\)/);
  await expect(page.getByRole('button', { name: 'Add today’s events' })).toHaveCount(0);
  await page.getByTestId('trade-row').last().click();
  await expect(page.getByTestId('trade-sheet').getByRole('img', { name: /candles, entry/ })).toBeVisible();

  const down = await page.context().newPage();
  const errors = watchErrors(down);
  await mockBackend(down, { marketDown: true });
  await signIn(down);
  await open(down, 'today');
  await expect(down.getByRole('group', { name: 'Market context (times ET)' })).toHaveCount(0);
  await expect(down.getByTestId('day-verdict')).toBeVisible();
  await down.getByTestId('trade-row').last().click();
  await expect(down.getByText('Chart unavailable for this trade')).toBeVisible();
  expect(errors.filter((e) => !e.includes('502'))).toEqual([]);
});

// ── No dead buttons ─────────────────────────────────────────────────────

/** Tag each distinct visible button with data-probe; repeated kinds (trade rows, calendar cells) count once. */
async function probe(page: Page, scope: string): Promise<{ i: number; key: string; disabled: boolean }[]> {
  return page.evaluate((scope) => {
    const root = document.querySelector(scope);
    if (!root) return [];
    const seen = new Set<string>();
    const out: { i: number; key: string; disabled: boolean }[] = [];
    let i = 0;
    for (const el of root.querySelectorAll<HTMLButtonElement>('button, [role=radio], a[href^="#"]')) {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || s.visibility === 'hidden' || el.hidden || el.closest('[aria-hidden="true"]')) continue;
      const key =
        el.dataset.testid ??
        (el.dataset.date ? 'calendar-cell' : `${el.tagName}:${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}`);
      if (seen.has(key)) continue;
      seen.add(key);
      el.setAttribute('data-probe', String(i));
      // Already-current tab links and already-selected radios are no-ops by design.
      const noop = el.getAttribute('aria-current') === 'page' || el.getAttribute('aria-checked') === 'true';
      out.push({ i: i++, key, disabled: noop || el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true' });
    }
    return out;
  }, scope);
}

const snapshot = (page: Page) =>
  page.evaluate(() => `${location.hash}|${scrollY}|${document.activeElement?.outerHTML.slice(0, 80)}|${document.body.innerHTML.length}|${[...document.body.innerHTML].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381)}`);

for (const route of ROUTES) {
  test(`no dead buttons: ${route}`, async ({ page }, info) => {
    test.skip(!['phone-360', 'desktop-1440'].includes(info.project.name), 'two widths are enough for the click sweep');
    test.setTimeout(180_000);
    const errors = watchErrors(page);
    await mockBackend(page);
    await signIn(page);
    await open(page, route);
    const buttons = await probe(page, 'body');
    expect(buttons.length).toBeGreaterThan(3);
    const dead: string[] = [];
    for (const b of buttons) {
      if (b.disabled) continue;
      await page.reload();
      await open(page, route);
      await probe(page, 'body');
      const el = page.locator(`[data-probe="${b.i}"]`);
      if (!(await el.count())) continue;
      let chooser = false;
      const onChooser = () => (chooser = true);
      page.on('filechooser', onChooser);
      const before = await snapshot(page);
      await el.scrollIntoViewIfNeeded();
      await el.click({ timeout: 3_000 });
      await page.waitForTimeout(200);
      const after = await snapshot(page);
      page.off('filechooser', onChooser);
      if (before === after && !chooser) dead.push(b.key);
    }
    expect(dead, 'buttons that did nothing visible').toEqual([]);
    expect(errors).toEqual([]);
  });
}
