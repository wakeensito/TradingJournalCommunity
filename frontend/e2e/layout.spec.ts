import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

const ROUTES = ['today', 'calendar', 'trades', 'insights', 'settings'];

for (const route of ROUTES) {
  test(`layout: ${route} has no horizontal overflow and nothing off-screen`, async ({ page, isMobile }) => {
    await openApp(page, route);
    await page.waitForTimeout(300);
    const issues = await page.evaluate(() => {
      const out: string[] = [];
      if (document.documentElement.scrollWidth > window.innerWidth) {
        out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
      }
      for (const el of document.querySelectorAll<HTMLElement>('button, a[href], input, textarea, select')) {
        const s = getComputedStyle(el);
        if (s.visibility === 'hidden' || s.display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        // Elements inside intentional horizontal scrollers (ticker, chip rows, tables) may extend past the edge.
        if (el.closest('.scroll-x, .overflow-auto, .overflow-x-auto')) continue;
        if (r.left < -0.5 || r.right > window.innerWidth + 0.5) {
          out.push(`${el.tagName.toLowerCase()} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 40)}" spans ${Math.round(r.left)}–${Math.round(r.right)}`);
        }
      }
      return out;
    });
    expect(issues).toEqual([]);

    if (isMobile) {
      const bar = page.getByTestId('tabbar');
      await expect(bar).toBeVisible();
      for (const name of ['Today', 'Calendar', 'Log a trade', 'Trades', 'Insights']) {
        const item = bar.getByRole(name === 'Log a trade' ? 'button' : 'link', { name, exact: true });
        await expect(item).toBeInViewport({ ratio: 1 });
      }
      // The last piece of content must be reachable above the fixed tab bar.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const barTop = (await bar.boundingBox())!.y;
      const lastBottom = await page.evaluate(() => {
        const main = document.querySelector('main');
        const kids = main ? [...main.querySelectorAll('section, ul, .card')] : [];
        return Math.max(0, ...kids.map((k) => k.getBoundingClientRect().bottom));
      });
      expect(lastBottom).toBeLessThanOrEqual(barTop + 1);
    }
  });
}
