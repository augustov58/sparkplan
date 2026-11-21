import { test, expect, type Page } from '@playwright/test';

/**
 * #271 (PE ruling 2026-11-20) — EV branch circuits of 100 A or less size from
 * Table 310.16's 60 °C column (NEC 110.14(C)(1)(a)) in the EV Panel Builder
 * and the EV Charging calculator, each with a note for the 75 °C option.
 * Expected: the issue's Acceptance section. Read-only (builder preview and
 * calculator); the created circuits are pinned in tests/evConductor60C271.test.ts.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

async function openTools(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText('QA EV builder', { exact: true }).first();
  await expect(card, 'QA project "QA EV builder" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/tools'));
  return page.locator('main');
}

test('#271 EV Panel Builder: 60 °C conductors with the 75 °C option noted', async ({ page }) => {
  const main = await openTools(page);
  await page.getByRole('button', { name: 'EV Panel Builder' }).click();
  const note = page.getByTestId('ev-builder-conductor-note');

  await main.getByText('Level 2 (48A)', { exact: true }).first().click();
  await expect(main).toContainText('each on a 60A breaker with 4 AWG Cu');   // was 6 AWG
  await expect(note).toContainText('6 AWG Cu is allowed if the charger and breaker terminals are both listed for 75 °C');

  await main.getByText('Level 2 (80A)', { exact: true }).first().click();
  await expect(main).toContainText('each on a 100A breaker with 1 AWG Cu');  // was 3 AWG
  await expect(note).toContainText('3 AWG Cu is allowed');

  await main.getByText('DC Fast Charge (150kW)', { exact: true }).first().click();
  await expect(main).toContainText('each on a 250A breaker with 250 kcmil Cu');
  await expect(note).toHaveCount(0); // above 100 A: 75 °C already
});

test('#271 EV Charging calculator: 48 A → 4 AWG Cu, 75 °C option 6 AWG Cu', async ({ page }) => {
  const main = await openTools(page);
  await page.getByRole('button', { name: /^EV Charging/ }).first().click();
  const level = main.locator('select').filter({ has: page.locator('option[value="Level3_DCFC"]') }).first();
  const amps = main.locator('label', { hasText: 'Charger Amps' }).locator('xpath=..').locator('select');
  await level.selectOption('Level2');
  await amps.selectOption({ label: '48A (11.5 kW)' });
  await expect(main).toContainText(/Circuit Breaker:\s*60A/);
  await expect(main).toContainText(/Conductor Size:\s*4 AWG/);
  await expect(page.getByTestId('ev-calc-conductor-note'))
    .toContainText('6 AWG Cu is allowed if the charger and breaker terminals are both listed for 75 °C');
});
