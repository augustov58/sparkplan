import { test, expect } from '@playwright/test';

/**
 * #260 — the Commercial Load Calculator's lighting demand reads the shared
 * Table 220.42 data: every non-dwelling occupancy at 100% ("All others") until
 * book rows exist. Its inline copy put warehouses below the table. Expected:
 * the issue's Acceptance section. The calculator's inputs live in the tab;
 * nothing is saved.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#260 warehouse and hospital lighting take 100% (warehouse 30.0 kVA, was 14.0)', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText('QA Commercial calc', { exact: true }).first();
  await expect(card, 'QA project "QA Commercial calc" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/load-calc'));
  const main = page.locator('main');
  const occupancy = main.locator('select').filter({ has: page.locator('option[value="warehouse"]') }).first();
  const area = main.locator('label', { hasText: /Floor Area/i }).first().locator('xpath=..').locator('input').first();
  for (const [type, sqft, kVA] of [['warehouse', '25000', '30.0'], ['hospitals', '50000', '80.0'], ['office_buildings', '10000', '13.0']] as const) {
    await occupancy.selectOption(type);
    await area.fill(sqft);
    await area.blur();
    await expect(main).toContainText(new RegExp(`General Lighting[\\s\\S]{0,120}Connected\\s*${kVA.replace('.', '\\.')} kVA\\s*Demand\\s*${kVA.replace('.', '\\.')} kVA`));
  }
});
