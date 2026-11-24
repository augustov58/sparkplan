import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #297 (owner ruling 2026-11-23): `App.tsx::ProjectWrapper` redirects to the
 * dashboard only when a loaded projects list lacks the project — never while
 * the list or auth is (re)loading. On main a browser reload on a project page
 * landed on `#/`.
 *
 * QA project "QA Short circuit" (tests/e2e/fixtures.md), read only.
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-297';
mkdirSync(OUT, { recursive: true });

test('#297 a project page survives a reload and a token refresh; an unknown id goes to the dashboard', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText('QA Short circuit', { exact: true }).first();
  await expect(card, 'QA project "QA Short circuit" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
  const scUrl = `${projectUrl}/short-circuit`;
  await page.goto(scUrl);
  const heading = page.getByRole('heading', { name: 'Short Circuit Analysis' }).first();
  await expect(heading).toBeVisible({ timeout: 15_000 });

  // 1: a browser reload stays on the page (main: lands on #/)
  await page.reload();
  await expect(heading).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2_000); // a late redirect would land here
  expect(page.url()).toBe(scUrl);
  await expect(heading).toBeVisible();
  await page.screenshot({ path: join(OUT, 'spec-after-reload.png') });

  // 2: a forced token refresh keeps the page mounted (the marked element survives)
  await heading.evaluate((el) => el.setAttribute('data-issue-297', 'mounted'));
  const refreshed = await page.evaluate(async () => {
    // @ts-expect-error — served by the Vite dev server
    const { supabase } = await import('/lib/supabase.ts');
    const { error } = await supabase.auth.refreshSession();
    return error ? error.message : 'ok';
  });
  expect(refreshed).toBe('ok');
  await page.waitForTimeout(4_000);
  expect(page.url()).toBe(scUrl);
  await expect(page.locator('[data-issue-297="mounted"]')).toBeVisible();

  // 3: an unknown project id still goes to the dashboard, also after a reload
  const unknown = page.url().replace(/#\/project\/[^/?]+/, '#/project/00000000-0000-0000-0000-000000000000');
  await page.goto(unknown);
  await page.waitForURL((u) => u.hash === '#/', { timeout: 20_000 });
  await page.goto(unknown);
  await page.reload();
  await page.waitForURL((u) => u.hash === '#/', { timeout: 20_000 });
  await expect(page.getByText('QA Short circuit', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
});
