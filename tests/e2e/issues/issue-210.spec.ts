import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #210 — NEC 625.42: an EVEMS setpoint limits the feeder AND the service, so
 * the MDP counts a downstream EV panel's chargers at the setpoint, not at
 * full load. Expected values: the hand calculation in the issue's
 * Acceptance section. QA project: tests/e2e/fixtures.md. Read-only.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-210';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = 'QA EVEMS downstream';

test('#210 the MDP takes a downstream EV panel at its EVEMS setpoint', async ({ page }) => {
  test.setTimeout(90_000);

  // The welcome modal opens while the project list is still loading
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');

  // 1 — Panel Schedule → MDP (selected first): 49,860 − (34,560 − 28,800) = 44,100 VA
  await page.goto(`${projectUrl}/panel`);
  const summary = page.locator('h4', { hasText: 'PANEL SUMMARY' }).locator('..');
  await expect(summary).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('main')).toContainText(/FEED-THRU TOTAL:\s*44\.1 kVA/);
  await expect(summary).toContainText(/DEMAND WITH FEEDERS\s*44\.1 KVA/i); // was 49.9
  await expect(summary).toContainText(/DEMAND AMPS\s*183\.8 A/i); // 44,100 ÷ 240 (was 207.8)
  const aggregated = page.locator('main');
  // The text is title case; CSS shows it in capitals
  await expect(aggregated).toContainText(/TOTAL CONNECTED\s*49\.9 kVA/i); // chargers at nameplate
  await expect(aggregated).toContainText(/TOTAL DEMAND\s*44\.1 kVA/i);
  await expect(aggregated).toContainText('EVEMS feeder reduction (EV Panel)');
  await shot(page, '1-mdp');

  // 2 — Service Upgrade Wizard: (44,100 + 25% × 30,300) ÷ 240 = 215 A (was 239 A)
  await page.goto(`${projectUrl}/tools`);
  await page.getByRole('button', { name: 'Service Upgrade (NEC 230.42)' }).click();
  await expect(page.locator('main')).toContainText(/From proposed circuits:\s*215A/, { timeout: 15_000 });
  await shot(page, '2-wizard');
});
