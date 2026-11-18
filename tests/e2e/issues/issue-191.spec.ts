import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #191 — the Panel Schedule's demand table and summary cards read the shared
 * aggregate (the packet's function): lighting and water heaters at 100%, not
 * 125%; four heating circuits at 100%, not 75%.
 * Expected values: the hand calculation in the issue's Acceptance section.
 * QA project: tests/e2e/fixtures.md. Read-only: the spec changes no data.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-191';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

/** Open a QA project's Panel Schedule and return its demand table and summary card */
async function openPanelSchedule(page: Page, projectName: string) {
  // The welcome modal opens while the project list is still loading
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded'); // not networkidle: realtime keeps the dashboard busy; the next step waits for what it needs
  const card = page.getByText(projectName, { exact: true }).first();
  await expect(card, `QA project "${projectName}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/panel'));
  const table = page.locator('span', { hasText: 'DEMAND FACTOR CALCULATION' }).locator('xpath=ancestor::div[.//table][1]').locator('table');
  await expect(table).toBeVisible({ timeout: 20_000 });
  const summary = page.locator('h4', { hasText: 'PANEL SUMMARY' }).locator('..');
  return { table, summary };
}

test('#191 Panel Schedule demand table and cards come from the shared aggregate', async ({ page }) => {
  test.setTimeout(90_000);
  const { table, summary } = await openPanelSchedule(page, 'QA Commercial panel');
  const row = (loadType: string) => table.locator('tbody tr', { hasText: loadType });
  // Cells: load type | connected kVA | demand factor | demand kVA | NEC
  const expectRow = async (loadType: string, connected: string, demand: string) => {
    const cells = row(loadType).locator('td');
    await expect(cells.nth(1)).toHaveText(connected);
    await expect(cells.nth(2)).toHaveText('1.00');
    await expect(cells.nth(3)).toHaveText(demand);
  };

  // 1 — the demand table: every load type at 100%
  await expectRow('Lighting', '3.00', '3.00'); // was 3.75 (× 1.25)
  await expectRow('Receptacles', '1.80', '1.80');
  await expectRow('Heating', '12.00', '12.00'); // was 9.00 (× 0.75)
  await expectRow('Water Heater', '4.50', '4.50'); // was 5.63 (× 1.25)
  const totals = table.locator('tfoot td');
  await expect(totals.nth(1)).toHaveText('21.30');
  await expect(totals.nth(3)).toHaveText('21.30');
  await expect(table).not.toContainText('1.25');
  await expect(table).not.toContainText('0.75');

  // 2 — the summary cards agree with the table
  await expect(summary).toContainText(/Direct Circuits Load\s*21\.3 KVA/i);
  await expect(summary).toContainText(/Direct Demand Load\s*21\.3\s*KVA/i);
  await expect(summary).toContainText(/Demand Amps\s*59\.1 A/i);

  // Guardrails: phase loads are untouched
  await expect(summary).toContainText(/Phase Imbalance\s*59\.2%/i);
  await expect(page.locator('main')).toContainText(/PHASE TOTALS \(KVA\):\s*9\.0\s*4\.8\s*7\.5/);
  await shot(page, '1-mdp');
});

test('#191 an EVEMS-managed panel: the table total and the card both show the setpoint', async ({ page }) => {
  test.setTimeout(90_000);
  const { table, summary } = await openPanelSchedule(page, 'QA EVEMS panel');

  // 3 — four 11,520 VA chargers (46.08 kVA) under a 20,000 VA EVEMS setpoint
  const totals = table.locator('tfoot td');
  await expect(totals.nth(1)).toHaveText('46.08');
  await expect(totals.nth(3)).toHaveText('20.00');
  await expect(table.locator('tbody tr', { hasText: 'EVEMS' }).locator('td').nth(3)).toHaveText('20.00');
  await expect(summary).toContainText(/Direct Circuits Load\s*46\.1 KVA/i);
  await expect(summary).toContainText(/Direct Demand Load\s*\(NEC 625\.42 EVEMS\)\s*20\.0\s*KVA/i);
  await expect(summary).toContainText(/Demand Amps\s*55\.5 A/i);
  await shot(page, '3-evems-panel');
});
