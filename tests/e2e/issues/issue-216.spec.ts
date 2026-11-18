import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #216 — a single-family dwelling's service load reads every circuit under
 * the MDP, its subpanels included. Expected values: the hand calculation in
 * the issue's Acceptance section. QA project: tests/e2e/fixtures.md. Read-only.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-216';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = 'QA SF subpanel';

test('#216 the single-family service load includes the garage subpanel', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded'); // not networkidle: realtime keeps the dashboard busy; the next step waits for what it needs
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
  const main = page.locator('main');

  // 1 — Main Panel: Part III over the whole dwelling = 37,375 VA (was 29.6 kVA, MDP circuits only)
  await page.goto(`${projectUrl}/panel`);
  const summary = page.locator('h4', { hasText: 'PANEL SUMMARY' }).locator('..');
  await expect(summary).toBeVisible({ timeout: 20_000 });
  await expect(summary).toContainText(/DWELLING DEMAND \(ALL PANELS\)\s*\(NEC 220 Part III\)\s*37\.4 KVA/i);
  await expect(summary).toContainText(/DEMAND AMPS\s*155\.7 A/i); // 37,375 ÷ 240
  await expect(summary).toContainText(/DEMAND WITH FEEDERS\s*37\.4 KVA/i); // was 54.8 (per-type cascade)
  await expect(main).not.toContainText('AGGREGATED LOAD (NEC 220.40)');
  await expect(main).toContainText(/Workshop Air Compressor\s*1\.80\s*0\.75\s*1\.35/); // 220.53: 4 appliances
  await shot(page, '1-main-panel');

  // 2 — Dwelling Load Calculator: the same input
  await page.goto(`${projectUrl}/load-calc`);
  await expect(main).toContainText(/From the 22 circuits under Main Panel \(its subpanels included\)/, { timeout: 15_000 });
  await expect(main).toContainText(/Demand Load\s*37\.4 kVA/);
  await shot(page, '2-dwelling-calculator');
});
