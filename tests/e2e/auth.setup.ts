import { test as setup, expect, type Page } from '@playwright/test';
import { existsSync } from 'fs';

/**
 * Signs the e2e specs in as the QA account — never the owner's account.
 *
 * The local app talks to prod Supabase, so the specs may only write inside
 * the QA account (issue-verification skill). Every run checks that the
 * session belongs to E2E_QA_EMAIL and fails otherwise.
 *
 * The password is never stored: a saved session (tests/e2e/.auth/user.json,
 * gitignored) is reused and written back after the app refreshes its tokens,
 * so Supabase's refresh-token rotation keeps it alive. Sign in again only when
 * it has died: E2E_USER_PASSWORD from the environment, set for that one run.
 */

const AUTH_FILE = 'tests/e2e/.auth/user.json';

const signedInEmail = (page: Page) =>
  page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? '';
      if (!/^sb-.*-auth-token$/.test(key)) continue;
      try {
        return (JSON.parse(localStorage.getItem(key) ?? '{}')?.user?.email as string | undefined) ?? null;
      } catch {
        return null;
      }
    }
    return null;
  });

setup('authenticate', async ({ browser }) => {
  const qaEmail = process.env.E2E_QA_EMAIL?.toLowerCase();
  if (!qaEmail) {
    throw new Error('auth.setup needs E2E_QA_EMAIL (the QA account; see .claude/skills/issue-verification/SKILL.md).');
  }

  const reuse = existsSync(AUTH_FILE) && !process.env.E2E_FORCE_REAUTH;
  const context = await browser.newContext(reuse ? { storageState: AUTH_FILE } : {});
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  let email = await signedInEmail(page);
  if (!email) {
    const password = process.env.E2E_USER_PASSWORD;
    if (!password) {
      throw new Error(
        'The saved QA session is gone. Sign in once from your own terminal (the password is never written to disk):\n' +
          '  read -rs E2E_USER_PASSWORD && export E2E_USER_PASSWORD && npx playwright test --project=setup; unset E2E_USER_PASSWORD',
      );
    }
    await page.goto('/#/login');
    const emailField = page.getByLabel(/email/i).first();
    await emailField.waitFor({ state: 'visible', timeout: 15_000 });
    await emailField.fill(qaEmail);
    // #328: the password must never reach disk. A failure writes the page's
    // accessibility snapshot (textbox values included) to error-context.md,
    // so the field is emptied right after the attempt and on every path. The
    // setup project also runs without trace, screenshot or video (config).
    const passwordField = page.getByLabel(/password/i).first();
    const heading = page.getByRole('heading', { name: /sign in to your account/i });
    const pageError = page.getByText(/invalid login credentials|email not confirmed|too many requests|rate limit/i).first();
    let failure: string | null = null;
    try {
      await passwordField.fill(password);
      await page.getByRole('button', { name: /^sign in$/i }).click();
      await Promise.race([
        heading.waitFor({ state: 'hidden', timeout: 20_000 }),
        pageError.waitFor({ state: 'visible', timeout: 20_000 }),
      ]).catch(() => {});
      if (await heading.isVisible()) {
        failure = (await pageError.textContent().catch(() => null))?.trim() || 'still on the sign-in page after 20 s';
      }
    } finally {
      if (await passwordField.isVisible().catch(() => false)) await passwordField.fill('').catch(() => {});
    }
    if (failure) {
      await context.close();
      throw new Error(`Sign-in failed: ${failure}. Nothing was saved; the password is not stored.`);
    }
    await page.waitForLoadState('networkidle');
    email = await signedInEmail(page);
  }

  if (email?.toLowerCase() !== qaEmail) {
    await context.close();
    throw new Error(`Signed in as ${email ?? 'nobody'}, not the QA account (${qaEmail}). Specs only run in the QA account.`);
  }

  // Write back the refreshed tokens: the old refresh token is now spent.
  await context.storageState({ path: AUTH_FILE });
  await context.close();
  console.log(`[auth.setup] QA session ready (${email})`);
});
