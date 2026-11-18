import { test, expect } from '@playwright/test';

/**
 * #258 — Chapter 9 Table 9 R and XL follow the NEC 2023 book, including
 * aluminum conduit (it had no rows). Expected: the issue's Acceptance section.
 * Read-only (calculator state lives in the tab).
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#258 voltage drop with the book Table 9 values (PVC, steel, aluminum conduit)', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText('QA EV builder', { exact: true }).first();
  await expect(card, 'QA project "QA EV builder" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/tools'));
  const main = page.locator('main');
  await main.getByRole('button', { name: 'Voltage Drop (NEC 210.19)' }).first().click();
  const field = (label: string) => main.locator('label.label-xs', { hasText: label }).locator('xpath=..').locator('input,select').first();
  await field('Voltage (V)').fill('480');
  await field('Phase').selectOption('3');
  await field('Length (ft, one-way)').fill('100');
  await field('Load Current (A)').fill('400');

  for (const [size, conduit, volts, pct] of [
    ['750 kcmil', 'PVC', '2.51', '0.52'],        // was 2.36 V, 0.49%
    ['1000 kcmil', 'Steel', '2.74', '0.57'],     // was 2.34 V, 0.49%
    ['1000 kcmil', 'Aluminum', '2.47', '0.51'],  // was 0.00 V (no data)
  ] as const) {
    await field('Conductor Size').selectOption(size);
    await field('Conduit Type').selectOption(conduit);
    await field('Conduit Type').blur();
    await expect(main).toContainText(new RegExp(`${volts.replace('.', '\\.')} V\\s*${pct.replace('.', '\\.')}%`));
  }
  await expect(main).not.toContainText('Cannot find impedance data');
});
