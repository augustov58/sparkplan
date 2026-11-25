import { test as setup, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { loadEnv } from 'vite';

/**
 * Signs the e2e specs in as the QA account — never the owner's account.
 *
 * The local app talks to prod Supabase, so the specs may only write inside
 * the QA account (issue-verification skill). Every run checks that the
 * session belongs to E2E_QA_EMAIL and fails otherwise.
 *
 * The password is never stored. The saved session (tests/e2e/.auth/user.json,
 * gitignored) is renewed with its refresh token once, here, at the start of
 * every run (#339): the run starts with a full hour of access token, so no
 * test refreshes it, and the refresh token on disk stays unspent for the next
 * run. Supabase rotates refresh tokens and revokes the session when a spent
 * one is reused, which is what tests refreshing the same saved token did.
 * Sign in again only when the session has died: E2E_USER_PASSWORD from the
 * environment, set for that one run.
 */

const AUTH_FILE = 'tests/e2e/.auth/user.json';

type StorageItem = { name: string; value: string };

/** Renews the saved session in AUTH_FILE; returns why it couldn't, or null. */
async function renewSavedSession(): Promise<string | null> {
  const state = JSON.parse(readFileSync(AUTH_FILE, 'utf8'));
  const item: StorageItem | undefined = (state.origins ?? [])
    .flatMap((o: { localStorage?: StorageItem[] }) => o.localStorage ?? [])
    .find((i: StorageItem) => /^sb-.*-auth-token$/.test(i.name));
  if (!item) return 'no session in the saved file';
  const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: anonKey } = loadEnv('development', process.cwd(), 'VITE_SUPABASE_');
  if (!url || !anonKey) throw new Error('auth.setup needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (.env.local), as the dev server does.');
  const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: JSON.parse(item.value)?.refresh_token }),
  });
  const session = await res.json().catch(() => ({}));
  if (!res.ok || !session.access_token) return session.msg ?? session.error_description ?? `HTTP ${res.status}`;
  // Saved before anything else: the old refresh token is now spent.
  item.value = JSON.stringify({ ...session, expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + session.expires_in });
  writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2));
  return null;
}

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

  let reuse = existsSync(AUTH_FILE) && !process.env.E2E_FORCE_REAUTH;
  const dead = reuse ? await renewSavedSession() : null;
  if (dead) reuse = false;
  const context = await browser.newContext(reuse ? { storageState: AUTH_FILE } : {});
  const page = await context.newPage();
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  let email = await signedInEmail(page);
  if (!email) {
    const password = process.env.E2E_USER_PASSWORD;
    if (!password) {
      throw new Error(
        `The saved QA session is gone${dead ? ` (Supabase: ${dead})` : ''}. Sign in once` +
          ' from your own terminal (the password is never written to disk):\n' +
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
