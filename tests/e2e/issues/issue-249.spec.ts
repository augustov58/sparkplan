import { test, expect } from '@playwright/test';

/**
 * #249 — a 150 kW DC fast charger (150,000 VA in every calc) is sized at 125%
 * of 150,000 / (480 × √3) = 180.4 A → 225.5 A → a 250 A breaker, 250 kcmil Cu.
 * Expected: the issue's Acceptance section. Read-only (the builder preview);
 * the created circuits are pinned in tests/dcfcTemplateSizing249.test.ts.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#249 EV Panel Builder: DC Fast Charge is a 250 A breaker; 4 chargers need a 1200 A panel', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText('QA EV builder', { exact: true }).first();
  await expect(card, 'QA project "QA EV builder" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/tools'));
  await page.getByRole('button', { name: 'EV Panel Builder' }).click();
  const main = page.locator('main');
  await expect(main).toContainText('150 kW | 250A breaker | 480V 3φ'); // was 225A
  await main.getByText('DC Fast Charge (150kW)', { exact: true }).first().click();
  // Default 4 chargers + spare + lighting: 4 × 250 A + the 20 A circuits → 1200 A (was 1000 A)
  await expect(main).toContainText('1 Panel: 1200A, 480V, 3-phase');
});
