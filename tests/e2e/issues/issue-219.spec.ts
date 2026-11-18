import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #219 — voltage drop uses NEC Chapter 9 Table 9 Note 2 effective Z (from the
 * row's R and XL) and √3 on three-phase. Expected: the issue's Acceptance
 * section. Read-only (calculator; packet generation).
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-219';
mkdirSync(OUT, { recursive: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

async function openProject(page: import('@playwright/test').Page, name: string) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(name, { exact: true }).first();
  await expect(card, `QA project "${name}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

test('#219 the voltage-drop calculator: 2/0 Cu, 100 ft, 100 A, 208 V 3Φ', async ({ page }) => {
  const url = await openProject(page, 'QA EV builder');
  await page.goto(`${url}/tools`);
  const main = page.locator('main');
  await main.getByRole('button', { name: 'Voltage Drop (NEC 210.19)' }).first().click();
  const field = (label: string) => main.locator('label.label-xs', { hasText: label }).locator('xpath=..').locator('input,select').first();
  await field('Voltage (V)').fill('208');
  await field('Phase').selectOption('3');
  await field('Length (ft, one-way)').fill('100');
  await field('Load Current (A)').fill('100');
  await field('Conductor Size').selectOption('2/0 AWG');
  await field('Conductor Size').blur();
  // √3 × 100 × 100 × (0.10·0.85 + 0.043·0.527) / 1000 = 1.8646 V; ÷ 208 = 0.90% (was 1.08 V, 0.52%)
  await expect(main).toContainText(/1\.86 V\s*0\.90%/);
  await expect(main).toContainText('Effective Z: 0.1077 Ω/1000ft');
});

test('#219 E-102: the QA MF feeders at Table 9 effective Z', async ({ page }) => {
  test.setTimeout(150_000);
  const url = await openProject(page, 'QA MF feeders');
  await page.goto(`${url}/permit-packet`);
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000);
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, 'packet.pdf');
  await (await download).saveAs(pdf);
  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  const e102 = text.split('\f').find(p => p.includes('VD (%)') && p.includes('F-Unit101'))!; // the feeder table, not the TOC
  // 2 × 123.75 × 50 × 0.10765 / 1000 = 1.33 V, 0.56%; 2 × 80.4 × 50 × 0.15173 / 1000 = 1.22 V, 0.51% (both were 0.47%)
  expect(e102).toMatch(/F-Unit101[^\n]*0\.56%/);
  expect(e102).toMatch(/F-House[^\n]*0\.51%/);
  expect(e102).not.toMatch(/F-Unit101[^\n]*0\.47%/);
});
