import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * #205 (owner ruling 2026-11-24): the Commercial Load Calculator's HVAC row
 * asks for the nameplate rated-load current (RLA, A) per 440.6(A), the
 * Article 220 load at 100 %; "Continuous" adds the 125 % in service sizing
 * only. The app, the PDF and the CSV cite "NEC 220.14(C), 440.6(A)".
 * Numbers unchanged: 42 A × 208 V × √3 = 15,131 VA → 15.1 kVA; 18.9 kVA
 * continuous. Expected values: the issue's Acceptance section.
 *
 * QA project "QA Commercial calc" (tests/e2e/fixtures.md): the calculator's
 * own defaults; nothing is saved.
 */

const PROJECT_NAME = 'QA Commercial calc';
const OUT = 'tests/e2e/__output__/screenshots/issue-205';
mkdirSync(OUT, { recursive: true });

test('#205 the HVAC row asks for RLA and cites NEC 220.14(C), 440.6(A) in the app, PDF and CSV', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  // The calculator keeps its inputs in sessionStorage: a new context starts from the defaults
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/load-calc'));

  const main = page.locator('main');
  const breakdown = page.locator('h3', { hasText: 'Load Breakdown' }).locator('..');
  const row = breakdown.locator('div.space-y-2 > div', { hasText: 'HVAC Equipment' });
  const cells = (service: string) =>
    new RegExp(`Connected\\s*15\\.1 kVA\\s*Demand\\s*15\\.1 kVA\\s*Factor\\s*100%\\s*Service\\s*${service.replace('.', '\\.')} kVA`);

  // 1–3: the form and the results row
  await expect(main.locator('h3', { hasText: 'HVAC Equipment (NEC 220.14(C), 440.6(A))' })).toBeVisible({ timeout: 20_000 }); // main: (NEC 220.14(C))
  await expect(main.locator('label', { hasText: /^RLA \(A\)$/ })).toBeVisible(); // main: MCA (Amps)
  await expect(main).not.toContainText('MCA');
  await expect(row).toContainText(cells('18.9'));
  await expect(row).toContainText('NEC 220.14(C), 440.6(A)'); // main: NEC 220.14(C), 440.6
  await page.screenshot({ path: join(OUT, 'spec-calculator.png'), fullPage: true });

  // 5: the PDF
  const pdfDownload = page.waitForEvent('download', { timeout: 60_000 });
  await main.getByRole('button', { name: 'PDF', exact: true }).click();
  const pdf = join(OUT, 'commercial-load.pdf');
  await (await pdfDownload).saveAs(pdf);
  const pdfText = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
  expect(pdfText).toContain('HVAC Equipment (NEC 220.14(C), 440.6(A))'); // main: (NEC 220.14(C), 440.22)
  expect(pdfText).toMatch(/Description RLA \(A\) Voltage Phase Continuous Rooftop Unit #1 42 208V 3Ø Yes/); // main: MCA/FLA (A)
  expect(pdfText).toMatch(/HVAC Equipment 15,131 100% 15,131 Yes 18,914 NEC 220\.14\(C\), 440\.6\(A\)/);
  expect(pdfText).not.toContain('MCA');
  expect(pdfText).not.toContain('440.22');

  // 6: the CSV
  const csvDownload = page.waitForEvent('download', { timeout: 30_000 });
  await main.getByRole('button', { name: 'CSV', exact: true }).click();
  const csvPath = join(OUT, 'commercial-load.csv');
  await (await csvDownload).saveAs(csvPath);
  const csv = readFileSync(csvPath, 'utf8');
  expect(csv).toContain('RLA (A)'); // main: MCA/FLA (A)
  expect(csv).not.toContain('MCA');
  expect(csv).toMatch(/HVAC Equipment,15131,100(\.0)?,15131,Yes,18914,"NEC 220\.14\(C\), 440\.6\(A\)"/); // main: 440.6

  // 4: not continuous → 15.1 kVA in service sizing too (#195)
  await page.locator('label', { hasText: 'Continuous (125%)' }).first().locator('input').uncheck();
  await expect(row).toContainText(cells('15.1'));
});
