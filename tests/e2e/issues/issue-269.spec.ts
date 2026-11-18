import { test, expect } from '@playwright/test';

/**
 * #269 — the EV Charging calculator sizes conductors from Table 310.16
 * (data/nec) at the 110.14(C) column the app uses (60 °C ≤ 100 A, 75 °C
 * above), with parallel sets past one conductor. Expected: the issue's
 * Acceptance section. Read-only (calculator state lives in the tab).
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#269 EV Charging conductors: 250 kcmil, 2 × 350 kcmil, 600 kcmil; Level 2 unchanged', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText('QA EV builder', { exact: true }).first();
  await expect(card, 'QA project "QA EV builder" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/tools'));
  await page.getByRole('button', { name: /^EV Charging/ }).first().click();
  const main = page.locator('main');
  const level = main.locator('select').filter({ has: page.locator('option[value="Level3_DCFC"]') }).first();
  const amps = main.locator('label', { hasText: 'Charger Amps' }).locator('xpath=..').locator('select');
  const conductor = (size: string) => new RegExp(`Conductor Size:\\s*${size.replace(/[()×]/g, m => '\\' + m)}`);

  await level.selectOption('Level3_DCFC');
  for (const [label, breaker, size] of [
    ['180.4A (150 kW)', '250A', '250 kcmil'],                // was 300 kcmil
    ['421A (350 kW)', '600A', '2 × 350 kcmil (parallel)'],   // was 500 kcmil (380 A)
    ['300.7A (250 kW)', '400A', '600 kcmil'],                // was 500 kcmil (380 A)
  ] as const) {
    await amps.selectOption({ label });
    await expect(main).toContainText(new RegExp(`Circuit Breaker:\\s*${breaker}`));
    await expect(main).toContainText(conductor(size));
  }
  await level.selectOption('Level2');
  await amps.selectOption({ label: '48A (11.5 kW)' });
  await expect(main).toContainText(/Circuit Breaker:\s*60A/);
  await expect(main).toContainText(conductor('4 AWG')); // 60 °C column, unchanged
});
