import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #212 — the EVEMS row of a demand table is the reduction itself (connected
 * 0, demand negative, factor "—"), so the rows add up to the TOTAL row as in
 * every other table (#160). Totals unchanged. Expected: the issue's
 * Acceptance section. QA project: "QA EVEMS downstream". Read-only.
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-212';
mkdirSync(OUT, { recursive: true });

test('#212 the EVEMS reduction row makes the demand tables add up', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText('QA EVEMS downstream', { exact: true }).first();
  await expect(card, 'QA project "QA EVEMS downstream" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
  const main = page.locator('main');

  // 2 — MDP aggregated card: the reduction, not before → after
  await page.goto(`${projectUrl}/panel`);
  await expect(page.locator('h4', { hasText: 'PANEL SUMMARY' })).toBeVisible({ timeout: 20_000 });
  await expect(main).toContainText(/EV chargers above the EVEMS setpoint \(EV Panel\)\s*-5\.8 kVA \(NEC 625\.42\)/);
  await expect(main).not.toContainText('EVEMS feeder reduction');

  // 1 — EV Panel table: 1.80 + 34.56 − 5.76 = 30.60
  await main.getByText(/^EV Panel\(/).first().click();
  await expect(main).toContainText(/EV chargers above the EVEMS setpoint\s*0\.00\s*—\s*-5\.76/);
  await expect(main).toContainText(/TOTALS\s*36\.36\s*—\s*30\.60/);

  // 3–4 — the packet
  await page.goto(`${projectUrl}/permit-packet`);
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000);
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, 'packet.pdf');
  await (await download).saveAs(pdf);
  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  expect(text).toMatch(/EV chargers above the EVEMS setpoint \(EV\s+0\.00\s+—\s+-5\.76/); // E-101
  expect(text).toMatch(/TOTAL\s+49\.86\s+88\.4%\s+44\.10/);
  expect(text).toMatch(/EV chargers above the EVEMS setpoint\s+0\.0 kVA\s+-5\.8 kVA\s+—/); // the EV Panel page
  expect(text).not.toContain('EVEMS feeder reduction');
});
