import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #193 — tools that say whether the service is sufficient read the shared
 * check (NEC 220 load + 25% of continuous loads, NEC 230.42(A)(1); the check
 * E-102 and the Service Upgrade Wizard make), not rough rules of their own.
 * Expected values: the hand calculation in the issue's Acceptance section.
 * QA projects: tests/e2e/fixtures.md. Writes: Inspector Mode saves its report.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-193';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

async function openProject(page: Page, projectName: string): Promise<string> {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const card = page.getByText(projectName, { exact: true }).first();
  await expect(card, `QA project "${projectName}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

test.beforeEach(async ({ page }) => {
  // The welcome modal opens while the project list is still loading
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#193 Inspector Mode, EV Panel Builder and the wizard agree on the service check', async ({ page }) => {
  test.setTimeout(120_000);
  const projectUrl = await openProject(page, 'QA Service check');
  const main = page.locator('main');

  // 1 — Inspector: 49,860 + 25% × 36,060 = 58,875 VA = 245 A on 200 A → critical
  //     (was a warning at 83%: connected × 0.8)
  await page.goto(`${projectUrl}/inspector`);
  // The page shows the last saved report until the new run is saved: wait for
  // the save, or an old report's text would pass the assertions
  await expect(page.getByRole('button', { name: 'Run Inspection' })).toBeEnabled({ timeout: 15_000 });
  const saved = page.waitForResponse(
    r => r.url().includes('/rest/v1/inspector_reports') && r.request().method() === 'POST',
    { timeout: 20_000 },
  );
  await page.getByRole('button', { name: 'Run Inspection' }).click();
  await saved;
  await expect(main).toContainText('Service Undersized for Load', { timeout: 20_000 });
  await expect(main).not.toContainText('Service Nearing Capacity');
  await main.getByText('Service Undersized for Load').first().click();
  await expect(main).toContainText(/Service check of 245 A .*49\.9 kVA.*9\.0 kVA.* exceeds the 200 A service/);
  await shot(page, '1-inspector');

  // 2 — EV Panel Builder (defaults: 4 × 48 A, spare, lighting): with the panel,
  //     58,875 + 47,880 + 25% × 46,080 = 118,275 VA = 493 A (was "requires 280A")
  await page.goto(`${projectUrl}/tools`);
  await page.getByRole('button', { name: 'EV Panel Builder' }).click();
  await expect(main).toContainText(/With this panel, the service check is 493A on the 200A service/, { timeout: 15_000 });
  await expect(main).not.toContainText('requires 280A');
  await shot(page, '2-builder');

  // 3 — guardrail: the wizard already used the shared check
  await page.getByRole('button', { name: 'Service Upgrade (NEC 230.42)' }).click();
  await expect(main).toContainText(/From proposed circuits:\s*245A/, { timeout: 15_000 });
});

test('#193 the Multi-Family EV banner colour follows its own verdict', async ({ page }) => {
  test.setTimeout(90_000);
  const projectUrl = await openProject(page, 'QA MF feeders');
  await page.goto(`${projectUrl}/tools`);
  await page.getByRole('button', { name: 'Multi-Family EV (NEC 220.84)' }).click();
  const banner = page.locator('div.border-2.rounded-lg').first();
  await expect(banner).toContainText('Can support all 20 chargers with EVEMS', { timeout: 15_000 });
  // blue (EVEMS verdict), not the amber of the rough estimate (15 chargers)
  await expect(banner).toHaveClass(/bg-blue-50/);
  await expect(banner).toContainText('184%');
  // No upgrade needed with EVEMS: the upgrade card says so, not "Upgrade to A service"
  const main = page.locator('main');
  await expect(main).not.toContainText('Upgrade to A service');
  await expect(main).toContainText('Service upgrade not required if EVEMS is used (NEC 625.42)');
  await shot(page, '3-mf-banner');
});
