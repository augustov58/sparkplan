import { test, expect } from '@playwright/test';

/**
 * #276 — short circuit takes steel-conduit R and XL from NEC Chapter 9
 * Table 9's steel column once (no extra × 1.5 on XL). Expected: the issue's
 * Acceptance section (book R/XL, point-to-point). Read-only (calculator
 * state lives in the tab; nothing is saved).
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#276 short circuit in steel conduit uses the Table 9 steel row once', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText('QA EV builder', { exact: true }).first();
  await expect(card, 'QA project "QA EV builder" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/tools'));
  const main = page.locator('main');
  await main.getByRole('button', { name: 'Short Circuit (NEC 110.9)' }).first().click();
  const field = (label: string) => main.locator('label.label-xs', { hasText: label }).locator('xpath=..').locator('input,select').first();
  const amps = main.getByText(/A RMS/).first();

  // Service Entrance: 500 kVA, 480 V 3Φ, 5.75%, 100 ft of 500 kcmil Cu, 1 set
  await main.getByRole('button', { name: 'Service Entrance' }).first().click();
  await field('Service Voltage').selectOption('480');
  await field('Service Phase').selectOption('3');
  await field('Transformer kVA').fill('500');
  await field('Impedance (%)').fill('5.75');
  await field('Conductor Length (ft)').fill('100');
  await field('Conductor Size').selectOption('500 kcmil');
  await field('Material').selectOption('Cu');
  await field('Sets in Parallel').selectOption('1');

  await field('Conduit Type').selectOption('Steel');
  await field('Conduit Type').blur();
  await expect(amps).toHaveText(/^8,632(\.\d+)? A RMS$/);   // main: 8,275; #258 data with × 1.5: 8,089

  await field('Conduit Type').selectOption('PVC');
  await field('Conduit Type').blur();
  await expect(amps).toHaveText(/^8,871(\.\d+)? A RMS$/);   // no conduit factor

  await field('Conduit Type').selectOption('Aluminum');
  await field('Conduit Type').blur();
  await expect(amps).toHaveText(/^8,786(\.\d+)? A RMS$/);   // aluminum conduit, no conduit factor

  // Downstream Panel (always Cu in steel): from 22,000 A, 50 ft of 3/0, 240 V 1Φ
  await main.getByRole('button', { name: 'Downstream Panel' }).first().click();
  await field('Source Fault Current (A)').fill('22000');
  await field('Feeder Length (ft)').fill('50');
  await field('Conductor Size').selectOption('3/0 AWG');
  await field('Voltage (V)').selectOption('240');
  await field('Phase').selectOption('1');
  await field('Phase').blur();
  await expect(amps).toHaveText(/^11,783(\.\d+)? A RMS$/);  // 11,783.8 A
});
