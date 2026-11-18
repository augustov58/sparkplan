import { test, expect } from '@playwright/test';

/**
 * #214 — the Service Upgrade Wizard's result card names the proposed load as
 * a new load (not "continuous load") and cites the service check's sections
 * (230.42(A)(1), 220.87 by method, 625.41/625.42), not 210.19's "80% rule".
 * Wording only; the numbers don't change. QA project: tests/e2e/fixtures.md.
 * Read-only.
 */

const PROJECT_NAME = 'QA Service check';

test('#214 the wizard words the new load and its references by method', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/tools');
  await page.getByRole('button', { name: 'Service Upgrade (NEC 230.42)' }).click();
  const main = page.locator('main');

  // 1–2 — calculated (project data): guardrail 245 A unchanged
  await expect(main).toContainText(/From proposed circuits:\s*245A/, { timeout: 15_000 });
  await expect(main).toContainText('245A new load (NEC 220 demand increase + 25% of its continuous loads, NEC 230.42(A)(1))');
  await expect(main).not.toContainText('245A continuous load'); // was the card's wording
  await expect(main).not.toContainText('210.19 - Continuous Load (80% rule)');
  await expect(main).toContainText('NEC 230.42(A)(1) - Service conductors: the NEC 220 load + 25% of the continuous loads');
  await expect(main).toContainText('NEC 220.87 - Existing load calculated from the panel schedule');

  // 5 — calculated: the computed current load, read-only (a typed value was ignored)
  const usage = main.locator('label', { hasText: 'Current Usage (A)' }).locator('..').locator('input');
  await expect(usage).toHaveJSProperty('readOnly', true);
  await expect(usage).toHaveValue('0');
  await expect(main).toContainText('Current load: the NEC 220 demand of the existing circuits');

  // 3 — measured (12-month utility billing)
  const radios = main.locator('input[type=radio][name=existingLoadMethod]');
  await radios.nth(0).check();
  await expect(main).toContainText('new load (continuous loads at 125%)');
  await expect(main).toContainText('NEC 220.87(2) - Existing load: the measured peak × 125%');
  // 6 — the calculated-demand sentence is gone under a measured method
  await expect(main).not.toContainText('Current load: the NEC 220 demand of the existing circuits');
  await expect(main).toContainText('Service size auto-populated from your project panel schedule. Enter the measured (or known) existing peak');

  // 4 — measured 100 A × 1.25 = 125 A; 125 + 245 = 370 A (185%); 125 / 200 = 62.5%
  await expect(usage).toHaveJSProperty('readOnly', false);
  await usage.fill('100');
  await expect(main).toContainText(/Current: 125A\s*Added: \+245A\s*Total: 370A/); // was "Current: 100A"
  await expect(main).toContainText('Current Usage: 125A (100A × 1.25) (62.5%)');
  await expect(main).toContainText('Total Future Load: 370A (185%)');

  // 7 — manual entry: not a "measured peak"
  await radios.nth(3).check();
  await expect(main).toContainText('NEC 220.87 - Existing load: a manual entry × 125% (defensive default; source unknown)');
  await expect(main).not.toContainText('the measured peak × 125%');

  // 8 — a hand-picked load carries no circuit basis
  await radios.nth(2).check();
  const common = main.locator('select').filter({ has: page.locator('option', { hasText: '-- Select Load --' }) }).first();
  const ac = await common.locator('option', { hasText: 'Central A/C' }).first().textContent();
  await common.selectOption({ label: ac! });
  await expect(main).toContainText(/\d+A new load \(as entered\)/);
});
