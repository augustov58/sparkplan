import { test, expect, type Page, type Request } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #330: "Forgot your password?" led to a blank page, a recovery link dropped
 * the user on the dashboard with no way to set a password, and an expired
 * email link was a blank page. Expected values: the issue's Acceptance.
 *
 * Read-only. The signed-out tests stub Supabase's /auth/v1/recover and
 * /auth/v1/user (and answer every REST call with []), so no email is sent and
 * no account changes; the recovery "session" is a fake token the stubs accept.
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-330';
mkdirSync(OUT, { recursive: true });
const FAKE_USER = {
  id: '00000000-0000-4000-8000-000000000330', aud: 'authenticated', role: 'authenticated',
  email: 'someone@example.com', app_metadata: { provider: 'email' }, user_metadata: {},
};
const RECOVERY_LINK = '/#access_token=fake.jwt.token&refresh_token=fakerefresh&expires_in=3600&token_type=bearer&type=recovery';
const EXPIRED_LINK = '/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

/** Stubs the auth and REST endpoints; returns the recover and password requests it saw. */
async function stubSupabase(page: Page) {
  const seen = { recover: [] as Request[], updateUser: [] as Request[] };
  await page.route('**/auth/v1/recover**', (r) => { seen.recover.push(r.request()); return r.fulfill({ json: {} }); });
  await page.route('**/auth/v1/user', (r) => {
    if (r.request().method() === 'PUT') seen.updateUser.push(r.request());
    return r.fulfill({ json: FAKE_USER });
  });
  await page.route('**/auth/v1/token**', (r) => r.fulfill({ status: 400, json: { error: 'invalid_grant' } }));
  await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }));
  await page.route('**/functions/v1/**', (r) => r.fulfill({ json: {} }));
  return seen;
}

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('1–2 "Forgot your password?" opens the reset page and sends a link to the app root', async ({ page, baseURL }) => {
    const seen = await stubSupabase(page);
    await page.goto('/#/login');
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible(); // guardrail
    await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible(); // guardrail
    await page.getByRole('link', { name: 'Forgot your password?' }).click();
    await expect(page).toHaveURL(/#\/reset-password$/);
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible(); // main: blank page
    await page.getByLabel('Email Address').fill('someone@example.com');
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText("If an account exists for someone@example.com, we've sent a link to reset your password.")).toBeVisible();
    expect(seen.recover).toHaveLength(1);
    expect(seen.recover[0]!.postDataJSON()).toMatchObject({ email: 'someone@example.com' });
    expect(new URL(seen.recover[0]!.url()).searchParams.get('redirect_to')).toBe(new URL('/', baseURL).href); // the root, no route
    await page.screenshot({ path: join(OUT, 'reset-sent.png') });
  });

  test('3–5 a recovery link opens "Set a new password" and updates it', async ({ page }) => {
    const seen = await stubSupabase(page);
    await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
    await page.goto(RECOVERY_LINK);
    await expect(page).toHaveURL(/#\/update-password$/, { timeout: 15_000 }); // main: the dashboard
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
    await page.reload(); // the form survives a reload of the tab
    await expect(page).toHaveURL(/#\/update-password$/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toBeVisible();
    const update = page.getByRole('button', { name: 'Update password' });

    await page.getByLabel('New password', { exact: true }).fill('NewPassw0rd');
    await page.getByLabel('Confirm new password').fill('NewPassw0rx');
    await update.click();
    await expect(page.getByText("Passwords don't match")).toBeVisible();

    await page.getByLabel('New password', { exact: true }).fill('short');
    await page.getByLabel('Confirm new password').fill('short');
    await update.click();
    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
    expect(seen.updateUser).toHaveLength(0); // nothing sent for an invalid form
    await page.screenshot({ path: join(OUT, 'update-invalid.png') });

    await page.getByLabel('New password', { exact: true }).fill('NewPassw0rd');
    await page.getByLabel('Confirm new password').fill('NewPassw0rd');
    await update.click();
    await expect(page.getByText('Password updated')).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
    await page.goto('/#/reset-password'); // signed in now: away from the form, and not pulled back to it
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole('heading', { name: 'Set a new password' })).toHaveCount(0);
    expect(seen.updateUser).toHaveLength(1);
    expect(seen.updateUser[0]!.postDataJSON()).toMatchObject({ password: 'NewPassw0rd' });
  });

  test('6 signed out, /update-password goes to the sign-in page', async ({ page }) => {
    await stubSupabase(page);
    await page.goto('/#/update-password');
    await expect(page).toHaveURL(/#\/login$/);
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('7 an expired link explains itself on the sign-in page', async ({ page }) => {
    await stubSupabase(page);
    await page.goto(EXPIRED_LINK);
    await expect(page).toHaveURL(/#\/login$/, { timeout: 15_000 }); // main: blank page
    await expect(page.getByText('This email link has expired or was already used')).toBeVisible();
    await page.screenshot({ path: join(OUT, 'expired-link.png') });
    await page.getByRole('link', { name: 'Request a new reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
  });
});

test('6 signed in without a recovery link, /update-password goes to the dashboard', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/#/update-password');
  await expect(page).toHaveURL(/#\/$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Set a new password' })).toHaveCount(0);
});
