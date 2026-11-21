import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #279 — required AIC = the first standard rating at or above the calculated
 * available fault current (NEC 110.9, owner ruling 2026-11-21). No 1.25×
 * margin and no safety-factor row in the tool, the short-circuit PDF or the
 * packet; the Available Fault Current page prints the rating in kA.
 * Expected values: the issue's Acceptance section (hand-calculated).
 * QA project: tests/e2e/fixtures.md ("QA Short circuit" holds one service
 * calculation saved from the tool). Read-only: nothing is saved.
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-279';
mkdirSync(OUT, { recursive: true });
const PROJECT_NAME = 'QA Short circuit';

test('#279 required AIC is the next standard rating at or above the available fault current', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');

  // Steps 1–4: Tools → Short Circuit
  await page.goto(`${projectUrl}/tools`);
  const main = page.locator('main');
  await main.getByRole('button', { name: 'Short Circuit (NEC 110.9)' }).first().click();
  const field = (label: string) => main.locator('label.label-xs', { hasText: label }).locator('xpath=..').locator('input,select').first();
  const amps = main.getByText(/A RMS/).first();
  const results = amps.locator('xpath=ancestor::div[contains(@class,"bg-gray-50")][1]');

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
  await expect(amps).toHaveText(/^8,632(\.\d+)? A RMS$/);               // 1 (guardrail)
  await expect(results).toContainText('Required AIC: 10 kA');           // 2 — main: 14 kA
  await expect(results).not.toContainText('Safety Factor');             // 3
  await expect(results).toContainText('Use 10 kA AIC rated breakers');
  await page.screenshot({ path: join(OUT, 'tool-service.png') });

  await main.getByRole('button', { name: 'Downstream Panel' }).first().click();
  await field('Source Fault Current (A)').fill('10000');
  await field('Feeder Length (ft)').fill('50');
  await field('Conductor Size').selectOption('3/0 AWG');
  await field('Voltage (V)').selectOption('480');
  await field('Phase').selectOption('3');
  await field('Phase').blur();
  await expect(amps).toHaveText(/^8,542(\.\d+)? A RMS$/);               // 4
  await expect(results).toContainText('Required AIC: 10 kA');           // main: 14 kA
  await expect(results).not.toContainText('Safety Factor');

  // Step 5: the saved service row
  await page.goto(`${projectUrl}/short-circuit`);
  await expect(main.getByText(/calculations? saved/)).toBeVisible({ timeout: 15_000 });
  await main.getByText('Show Details').first().click();
  await expect(main).toContainText(/AIC:\s*10 kA/);
  await expect(main).not.toContainText('Safety Factor');

  // Step 6: that row's PDF
  const scPdf = join(OUT, 'sc-calc.pdf');
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    main.locator('button[title="Export to PDF"]').first().click(),
  ]);
  await dl.saveAs(scPdf);
  const scText = execFileSync('pdftotext', ['-layout', scPdf, '-'], { encoding: 'utf8' });
  expect(scText).toMatch(/REQUIRED AIC RATING[\s\S]{0,200}\b10 kA/);
  expect(scText).not.toMatch(/safety factor/i);

  // Steps 7–8: the packet
  await page.goto(`${projectUrl}/permit-packet`);
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000); // the generator reads the project's data after the button renders
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, 'packet.pdf');
  await (await download).saveAs(pdf);
  const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).split('\f');
  expect(pages.join('')).not.toMatch(/safety factor/i);

  const afc = pages.find(p => p.includes('Available Fault Current Calculation'))!;
  expect(afc, 'Available Fault Current page').toBeTruthy();
  expect(afc).toMatch(/MIN REQUIRED AIC[\s\S]{0,400}\b10\s?kA/);         // 8 — main: "14A"
  expect(afc).toMatch(/Minimum required AIC rating\s+10 kA/);           // main: "14 A"
  expect(afc).toMatch(/Available fault current at service main\s+8\.63 kA/); // guardrail

  const e103 = pages.find(p => p.includes('Per-Panel Short Circuit Analysis'))!;
  expect(e103, 'short-circuit table page').toBeTruthy();
  const rows = e103.split('\n').filter(l => /^\s*Service Entrance\s+Service\s/.test(l));
  expect(rows.length, 'service rows on the short-circuit table').toBeGreaterThan(0);
  for (const row of rows) expect(row).toMatch(/\s8\.6\s+10\s+Compliant/); // 7 — main: 14
  expect(e103).toMatch(/Highest Required AIC:\s+10 kA/);
});
