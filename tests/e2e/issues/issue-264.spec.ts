import { test, expect } from '@playwright/test';

/**
 * #264 — DC fast charger presets carry at least their output: kW ÷ (480 × √3),
 * to 0.1 A, as the EV Panel Builder (#249). Expected: the issue's Acceptance
 * section. Read-only (calculator state lives in the tab).
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#264 EV Charging: DC presets from their output; 150 kW is 180.4 A, 150 kVA, 250 A breaker', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText('QA EV builder', { exact: true }).first();
  await expect(card, 'QA project "QA EV builder" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/tools'));
  await page.getByRole('button', { name: /^EV Charging/ }).first().click();
  const main = page.locator('main');
  await main.locator('select').filter({ has: page.locator('option[value="Level3_DCFC"]') }).first().selectOption('Level3_DCFC');
  const amps = main.locator('label', { hasText: 'Charger Amps' }).locator('xpath=..').locator('select');
  await expect(amps.locator('option')).toHaveText(['63A (50 kW)', '120.3A (100 kW)', '180.4A (150 kW)', '300.7A (250 kW)', '421A (350 kW)']);
  await amps.selectOption({ label: '180.4A (150 kW)' });
  await expect(main).toContainText(/Circuit Breaker:\s*250A/);
  await expect(main).toContainText('149.98 kVA'); // √3 × 480 × 180.4 (was 160 A → 133.0 kVA)
});
