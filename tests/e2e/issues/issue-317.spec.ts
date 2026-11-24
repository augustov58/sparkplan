import { test, expect, type Page } from '@playwright/test';
import { mainTextWhen } from './pageText';

/**
 * #317 (owner 2026-11-24): a spec reads a page after its data has loaded, not
 * once after a heading. Each test holds a table's response back 3 s (the
 * request reaches the server; the page gets the rows late, #234's lesson) and
 * reads the page the way issue-291 / issue-289 / issue-301 now do.
 *
 * On main the one-time reads got: "TOTAL DEMAND 0.0 kVA" (291), the DP-1 card
 * without its panel, so no Stale check (289), and a 200 A prefill (301).
 *
 * Read-only: the short-circuit list is stubbed to [] in test 3 instead of
 * deleting the saved row; no writes are let through. QA projects:
 * tests/e2e/fixtures.md.
 */

async function holdBack(page: Page, table: 'panels' | 'circuits') {
  await page.route(`**/rest/v1/${table}?*`, async (route) => {
    if (route.request().method() !== 'GET') return route.abort();
    const response = await route.fetch();
    await new Promise((r) => setTimeout(r, 3_000));
    await route.fulfill({ response });
  });
}

async function openProject(page: Page, name: string) {
  await page.goto('/');
  const card = page.getByText(name, { exact: true }).first();
  await expect(card, `QA project "${name}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#317 the MDP demand is read once the circuits have loaded (issue-291)', async ({ page }) => {
  const projectUrl = await openProject(page, 'QA MF feeders');
  await holdBack(page, 'circuits');
  await page.goto(`${projectUrl}/panel`);
  const t = await mainTextWhen(page, ['TOTAL DEMAND 68.6 kVA']); // main read: TOTAL DEMAND 0.0 kVA
  expect(t).toContain('Multi-Family Dwelling (3 units) 109.5 kVA → 49.3 kVA (45%)');
});

test('#317 the short-circuit cards are read once the panels have loaded (issue-289)', async ({ page }) => {
  const projectUrl = await openProject(page, 'QA SC parallel');
  await holdBack(page, 'panels');
  await page.goto(`${projectUrl}/short-circuit`);
  await expect(page.locator('main').getByText('2 calculations saved')).toBeVisible({ timeout: 15_000 });
  const t = await mainTextWhen(page, ['DP-1 (400A, 480V)']); // main read: "DP-1 11/23/2026 …", no panel
  expect(t).toMatch(/DP-1 \(400A, 480V\) \d+\/\d+\/\d+ Fault: 15\.7 kA/);
  expect(t).not.toContain('Stale'); // the fixture's rows are current
});

test('#317 the service amps prefill is read once the panels have loaded (issue-301)', async ({ page }) => {
  const projectUrl = await openProject(page, 'QA Short circuit');
  await holdBack(page, 'panels');
  await page.route('**/rest/v1/short_circuit_calculations?*', (route) =>
    route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.abort());
  const main = page.locator('main');
  await page.goto(`${projectUrl}/short-circuit`);
  await expect(main.getByText('0 calculations saved')).toBeVisible({ timeout: 15_000 });
  const add = main.getByRole('button', { name: 'Add Short Circuit Calculation' });
  if (await add.isVisible()) await add.click();
  await main.getByRole('button', { name: 'Service Entrance' }).first().click();
  const amps = main.locator('label', { hasText: 'Service Amps' }).locator('xpath=..').locator('input,select').first();
  await expect(amps).toHaveValue('800', { timeout: 15_000 }); // main read: 200 (the seed before the MDP main)
});
