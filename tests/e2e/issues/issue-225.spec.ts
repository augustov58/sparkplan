import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #225 — Inspector Mode's NEC 408.30 bus check reads each panel's design load
 * (demand + 25% of continuous loads; the MDP's = the service check), not the
 * panel's own connected circuits, so an MDP with feeders no longer always
 * passes. Expected values: the hand calculation in the issue's Acceptance
 * section. QA project: tests/e2e/fixtures.md. Writes: Inspector saves its report.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-225';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = 'QA Service check';

test('#225 the bus check uses each panel\'s design load', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded'); // not networkidle: realtime keeps the dashboard busy; the next step waits for what it needs
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/inspector');
  const main = page.locator('main');

  // The page shows the last saved report until the new run is saved
  await expect(page.getByRole('button', { name: 'Run Inspection' })).toBeEnabled({ timeout: 15_000 });
  const saved = page.waitForResponse(
    r => r.url().includes('/rest/v1/inspector_reports') && r.request().method() === 'POST',
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Run Inspection' }).click();
  await saved;

  // MDP: the service check 58,875 VA = 245 A on its 200 A bus (was "acceptable")
  await main.getByText('Panel Overloaded Beyond Bus Rating').first().click();
  await expect(main).toContainText(/Panel MDP: 245 A .* exceeds its 200 A bus rating/);
  // EV Panel: 36,360 + 25% × 34,560 = 45,000 VA = 187.5 A, 94% (was "acceptable" at 76% connected)
  await main.getByText('Panel High Utilization').first().click();
  await expect(main).toContainText(/Panel EV Panel is at 94% of its 200 A bus/);
  // Office Panel: 13,875 VA = 58 A, passes
  await main.getByText(/View \d+ Passed Checks/).first().click();
  await expect(main).toContainText('Panel Office Panel: Bus loading acceptable');
  await expect(main).not.toContainText('Panel MDP: Bus loading acceptable');
  await expect(main).not.toContainText('Panel EV Panel: Bus loading acceptable');
  await shot(page, '1-inspector');
});
