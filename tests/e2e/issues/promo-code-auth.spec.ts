import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Promo codes (found 2026-11-24, readiness check): redeem_promo_code takes the
 * account from the caller's session (auth.uid()), only signed-in users can call
 * it, and nobody can list the codes. Before: the anon key could SELECT the
 * active codes and redeem one onto any account id.
 *
 * Read-only: every call uses a code that doesn't exist, or is refused before
 * the code lookup, so nothing is redeemed and no fixture changes.
 */

const QA_EMAIL = 'augustovalbuena+qa@gmail.com';
const BOGUS = 'QA-NO-SUCH-CODE-0000';
const OTHER_ACCOUNT = '00000000-0000-4000-8000-000000000000'; // any id that isn't the QA account's
const OUT = 'tests/e2e/__output__/screenshots/promo-code-auth';
mkdirSync(OUT, { recursive: true });

type Call = { rows?: number; data?: unknown; code?: string | null };

/** Runs one call from the page as the QA session ('qa') or with the public key only ('anon'). */
async function call(page: Page, as: 'qa' | 'anon', what: 'list' | 'redeem', userId?: string): Promise<Call> {
  return page.evaluate(async ({ as, what, userId, code, qaEmail }) => {
    // @ts-expect-error — served by the Vite dev server
    const { createClient } = await import('/node_modules/.vite/deps/@supabase_supabase-js.js');
    // @ts-expect-error — served by the Vite dev server
    const { supabase } = await import('/lib/supabase.ts');
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user?.email !== qaEmail) throw new Error('not the QA account');
    const client = as === 'qa' ? supabase : createClient(supabase.supabaseUrl, supabase.supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (what === 'list') {
      const { data, error } = await client.from('promo_codes').select('id'); // ids only, never the codes
      return { rows: data?.length ?? 0, code: error?.code ?? null };
    }
    const { data, error } = await client.rpc('redeem_promo_code', {
      p_code: code, p_user_id: userId === 'self' ? session.user.id : userId,
    });
    return { data, code: error?.code ?? null };
  }, { as, what, userId, code: BOGUS, qaEmail: QA_EMAIL });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await expect(page.getByText('Projects').first()).toBeVisible({ timeout: 15_000 });
});

test('nobody can list the promo codes', async ({ page }) => {
  expect(await call(page, 'anon', 'list')).toEqual({ rows: 0, code: null }); // main: 4 rows
  expect(await call(page, 'qa', 'list')).toEqual({ rows: 0, code: null }); // main: 4 rows
});

test('an anonymous caller cannot call redeem_promo_code', async ({ page }) => {
  const r = await call(page, 'anon', 'redeem', OTHER_ACCOUNT);
  expect(r.code).toBe('42501'); // permission denied; main: ran, "Invalid or expired promo code"
  expect(r.data).toBeNull();
});

test('a signed-in user redeems only for their own account', async ({ page }) => {
  expect(await call(page, 'qa', 'redeem', OTHER_ACCOUNT)).toEqual({
    data: { success: false, error: 'A promo code can only be redeemed for your own account' }, code: null,
  }); // main: reached the code lookup, "Invalid or expired promo code"
  expect(await call(page, 'qa', 'redeem', 'self')).toEqual({
    data: { success: false, error: 'Invalid or expired promo code' }, code: null,
  }); // guardrail: the user's own call still runs
});

test('the Pricing page promo box still answers a signed-in user', async ({ page }) => {
  await page.goto('/#/pricing');
  const box = page.getByPlaceholder('Enter promo code');
  await box.fill(BOGUS);
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('Invalid or expired promo code')).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: join(OUT, 'pricing-promo.png'), fullPage: true });
});
