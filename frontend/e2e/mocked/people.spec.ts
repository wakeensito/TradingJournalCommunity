// Settings → Your account + People (admin user management), backend-free.
//   npx playwright test -c playwright.mock.config.ts people
import { expect, test, type Page } from '@playwright/test';
import { ME, TEMP_PASSWORD, mockBackend, signIn } from './fixtures';

async function openSettings(page: Page) {
  await page.goto('/#/settings');
  await page.getByRole('heading', { level: 1, name: 'Settings' }).waitFor();
  await page.locator('[aria-busy="true"][aria-label="Loading"]').waitFor({ state: 'detached' });
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  return errors;
}

/** Horizontal overflow + interactive elements under 44×44 (the ::after hit pad counts) inside `scope`. */
async function audit(page: Page, scope: string, minTarget: number) {
  return page.evaluate(
    ({ scope, minTarget }) => {
      const root = document.querySelector(scope) ?? document.body;
      const small: string[] = [];
      for (const el of root.querySelectorAll<HTMLElement>('button, a[href], input:not([type=hidden]), [role=radio]')) {
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden' || el.hidden || el.closest('[aria-hidden="true"]')) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        // Checkboxes are covered by their 44px-tall <label>.
        if (el instanceof HTMLInputElement && el.type === 'checkbox' && (el.closest('label')?.getBoundingClientRect().height ?? 0) >= 44) continue;
        const a = getComputedStyle(el, '::after');
        let w = r.width;
        let h = r.height;
        if (a.content !== 'none' && a.position === 'absolute') {
          const px = (v: string) => (v.endsWith('px') ? parseFloat(v) : 0);
          h = Math.max(h, h - px(a.top) - px(a.bottom));
          w = Math.max(w, w - px(a.left) - px(a.right));
        }
        if (minTarget && (w < minTarget - 0.5 || h < minTarget - 0.5)) small.push(`${el.tagName} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}" ${Math.round(w)}×${Math.round(h)}`);
      }
      return { small, overflow: document.documentElement.scrollWidth > window.innerWidth ? document.documentElement.scrollWidth : 0 };
    },
    { scope, minTarget },
  );
}

test('non-admin: Your account shows, People never appears and no admin call is made', async ({ page }) => {
  const errors = watchErrors(page);
  const mock = await mockBackend(page);
  await signIn(page);
  await openSettings(page);
  await expect(page.getByRole('region', { name: 'Your account' })).toBeVisible();
  await expect(page.getByTestId('account-email')).toHaveText(ME);
  await page.waitForTimeout(300);
  await expect(page.getByRole('region', { name: 'People' })).toHaveCount(0);
  expect(mock.adminCalls).toEqual([]);
  expect(errors).toEqual([]);
});

test('change password: validates, then calls Cognito ChangePassword and toasts', async ({ page }) => {
  const mock = await mockBackend(page);
  await signIn(page);
  await openSettings(page);
  await page.getByRole('button', { name: 'Change password' }).click();
  const sheet = page.getByTestId('change-password');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Save password' }).click();
  await expect(sheet.getByText('Enter your current password.')).toBeVisible();
  await sheet.locator('#pw-current').fill('OldPass123');
  await sheet.locator('#pw-new').fill('weak');
  await sheet.locator('#pw-confirm').fill('weak');
  await expect(sheet.getByRole('alert').filter({ hasText: '8+ characters' })).toBeVisible();
  await sheet.locator('#pw-new').fill('NewPass456');
  await sheet.locator('#pw-confirm').fill('NewPass457');
  await expect(sheet.getByText('The two new passwords don’t match.')).toBeVisible();
  await sheet.locator('#pw-confirm').fill('NewPass456');
  await sheet.getByRole('button', { name: 'Save password' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: 'Password changed.' })).toBeVisible();
  expect(mock.cognitoCalls).toContain('ChangePassword');
});

test('sign out of all devices: confirm, GlobalSignOut, back to sign-in', async ({ page }) => {
  const mock = await mockBackend(page);
  await signIn(page);
  await openSettings(page);
  await page.getByRole('button', { name: 'Sign out of all devices' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Sign out everywhere' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  expect(mock.cognitoCalls).toContain('GlobalSignOut');
  expect(await page.evaluate(() => localStorage.getItem('tj.auth'))).toBeNull();
});

test('admin: People lists users with status pills and an Admin badge; layout holds', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  await mockBackend(page, { admin: true });
  await signIn(page);
  await openSettings(page);
  const people = page.getByRole('region', { name: 'People' });
  const list = people.getByTestId('people-list');
  await expect(list.getByRole('listitem')).toHaveCount(4);
  await expect(list.getByRole('button', { name: /^friend@example\.com, Active$/ })).toBeVisible();
  await expect(list.getByRole('button', { name: /^invited@example\.com, Invited$/ })).toBeVisible();
  await expect(list.getByRole('button', { name: new RegExp(`^${ME.replace('.', '\\.')} \\(you\\), Active, admin$`) })).toBeVisible();
  await expect(list.getByRole('button', { name: /, Disabled$/ })).toBeVisible();
  const a = await audit(page, 'main', isMobile ? 44 : 0);
  expect(a.overflow, 'horizontal page overflow').toBe(0);
  expect(a.small).toEqual([]);
  expect(errors).toEqual([]);
});

test('admin: invite shows the temporary password once, with copy', async ({ page, context, isMobile }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const mock = await mockBackend(page, { admin: true });
  await signIn(page);
  await openSettings(page);
  await page.getByRole('region', { name: 'People' }).getByRole('button', { name: 'Invite', exact: true }).click();
  const sheet = page.getByTestId('invite-sheet');
  await sheet.getByRole('button', { name: 'Send invite' }).click();
  await expect(sheet.getByText('Enter a valid email address.')).toBeVisible();
  await sheet.locator('#inv-email').fill('New.Trader@Example.com');
  await sheet.getByText('Make admin').click();
  await sheet.getByRole('button', { name: 'Send invite' }).click();
  await expect(sheet.getByRole('heading', { name: 'Invite sent' })).toBeVisible();
  await expect(sheet.getByTestId('temp-password-value')).toHaveText(TEMP_PASSWORD);
  await expect(sheet.getByText('An invite email was sent')).toBeVisible();
  const a = await audit(page, '[data-testid="invite-sheet"]', isMobile ? 44 : 0);
  expect(a.small).toEqual([]);
  await sheet.getByRole('button', { name: 'Copy temporary password' }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(TEMP_PASSWORD);
  await sheet.getByRole('button', { name: 'Done' }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByTestId('people-list').getByRole('button', { name: /^new\.trader@example\.com, Invited, admin$/ })).toBeVisible();
  expect(mock.adminCalls).toContain('POST /admin/users');
  expect(mock.adminUsers.find((u) => u.email === 'new.trader@example.com')?.isAdmin).toBe(true);
});

test('admin: invite surfaces a duplicate-email error in the sheet', async ({ page }) => {
  await mockBackend(page, { admin: true });
  await signIn(page);
  await openSettings(page);
  await page.getByRole('region', { name: 'People' }).getByRole('button', { name: 'Invite', exact: true }).click();
  const sheet = page.getByTestId('invite-sheet');
  await sheet.locator('#inv-email').fill('friend@example.com');
  await sheet.getByRole('button', { name: 'Send invite' }).click();
  await expect(sheet.getByRole('alert').filter({ hasText: 'That email already has an account.' })).toBeVisible();
});

test('admin: own row has no destructive actions', async ({ page }) => {
  await mockBackend(page, { admin: true });
  await signIn(page);
  await openSettings(page);
  await page.getByTestId('people-list').getByRole('button', { name: /\(you\)/ }).click();
  const sheet = page.getByTestId('user-sheet');
  await expect(sheet.getByText('This is you.')).toBeVisible();
  for (const name of ['Disable', 'Remove user', 'Remove admin', 'Reset password']) {
    await expect(sheet.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
});

test('admin: reset password, resend invite, promote, disable', async ({ page, isMobile }) => {
  const mock = await mockBackend(page, { admin: true });
  await signIn(page);
  await openSettings(page);
  const list = page.getByTestId('people-list');

  await list.getByRole('button', { name: /^invited@example\.com/ }).click();
  let sheet = page.getByTestId('user-sheet');
  const a = await audit(page, '[data-testid="user-sheet"]', isMobile ? 44 : 0);
  expect(a.small).toEqual([]);
  await sheet.getByRole('button', { name: 'Resend invite', exact: true }).click();
  await expect(sheet.getByTestId('temp-password-value')).toHaveText(TEMP_PASSWORD);
  await sheet.getByRole('button', { name: 'Close' }).click();

  await list.getByRole('button', { name: /^friend@example\.com/ }).click();
  sheet = page.getByTestId('user-sheet');
  await expect(sheet.getByRole('button', { name: 'Resend invite', exact: true })).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Reset password', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reset password' }).click();
  await expect(sheet.getByTestId('temp-password-value')).toHaveText(TEMP_PASSWORD);
  await sheet.getByRole('button', { name: 'Make admin', exact: true }).click();
  await expect(sheet.getByRole('button', { name: 'Remove admin', exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Disable', exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Disable' }).click();
  await expect(sheet.getByRole('button', { name: 'Enable', exact: true })).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(list.getByRole('button', { name: /^friend@example\.com, Disabled, admin$/ })).toBeVisible();

  expect(mock.adminCalls).toEqual([
    'GET /admin/users',
    'POST /admin/users/u-invited/resend',
    'POST /admin/users/u-friend/reset-password',
    'POST /admin/users/u-friend/admin',
    'POST /admin/users/u-friend/disable',
  ]);
});

test('admin: remove user purges by default; unchecking keeps their data', async ({ page }) => {
  const mock = await mockBackend(page, { admin: true });
  await signIn(page);
  await openSettings(page);
  const list = page.getByTestId('people-list');

  await list.getByRole('button', { name: /^friend@example\.com/ }).click();
  await page.getByTestId('user-sheet').getByRole('button', { name: 'Remove user', exact: true }).click();
  let dialog = page.getByRole('alertdialog');
  await expect(dialog.getByTestId('purge-checkbox')).toBeChecked();
  await dialog.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'friend@example.com removed, with 42 journal items and 3 screenshots.' })).toBeVisible();
  await expect(list.getByRole('button', { name: /^friend@example\.com/ })).toHaveCount(0);

  await list.getByRole('button', { name: /^invited@example\.com/ }).click();
  await page.getByTestId('user-sheet').getByRole('button', { name: 'Remove user', exact: true }).click();
  dialog = page.getByRole('alertdialog');
  await dialog.getByTestId('purge-checkbox').uncheck();
  await dialog.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Their journal data was kept.' })).toBeVisible();

  expect(mock.adminCalls).toContain('DELETE /admin/users/u-friend?purge=true');
  expect(mock.adminCalls).toContain('DELETE /admin/users/u-invited');
});

test('admin: list error shows a retry', async ({ page }) => {
  await mockBackend(page, { admin: true, adminDown: true });
  await signIn(page);
  await openSettings(page);
  const people = page.getByRole('region', { name: 'People' });
  await expect(people.getByRole('alert')).toContainText('Something went wrong on our side');
  await expect(people.getByRole('button', { name: 'Try again' })).toBeVisible();
});
