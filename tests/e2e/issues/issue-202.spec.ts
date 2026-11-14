import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #202 — the EVEMS tool's "Maximum Chargers – With EVEMS" counts chargers that
 * each get at least 12 A under the largest setpoint (owner decision
 * 2026-11-14); with EVEMS on it shows the current each charger gets and warns
 * below 12 A; "Consider EVEMS" shows only when EVEMS is off.
 * Expected values: the hand calculation in the issue's Acceptance section.
 * QA project: tests/e2e/fixtures.md.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-202';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = 'QA EVEMS tool (NEC 2023)';
const MIN_WARNING = 'below the 12 A minimum';

test('#202 EVEMS max chargers at a 12 A minimum, current per charger, no stale note', async ({ page }) => {
  test.setTimeout(90_000);

  // The welcome modal opens while the project list is still loading
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/tools'));
  await page.getByRole('button', { name: /EVEMS Load Mgmt/ }).click();

  const quantity = page.locator("xpath=//label[normalize-space()='Quantity']/following-sibling::input");
  const evems = page.locator('#useEVEMS');
  const results = page.locator('h3', { hasText: 'Load Management Analysis' }).locator('..');
  const maxCard = page.locator('h4', { hasText: 'Maximum Chargers' }).locator('..');
  const expectMaxCard = async () => {
    await expect(maxCard).toContainText(/Without EVEMS\s*2(?!\d)/);
    await expect(maxCard).toContainText(/With EVEMS\s*6(?!\d)/);
    await expect(maxCard).toContainText('at 12 A minimum each');
    await expect(maxCard).toContainText('EVEMS allows 4 additional chargers');
  };

  // 1 — EVEMS off, two chargers: 90.0%, the "Consider EVEMS" note shows
  await quantity.fill('2');
  await expect(results).toContainText('90.0%');
  await expectMaxCard();
  await expect(results).toContainText('Consider EVEMS for future expansion');
  await shot(page, '1-off-qty2');

  // 2 — EVEMS on, two chargers: 64 A setpoint, 32.0 A each, no stale note
  await evems.check();
  await expect(results).toContainText('64.0 A shared by 2 chargers: 32.0 A each');
  await expect(results).toContainText('90.0%');
  await expectMaxCard();
  await expect(results).not.toContainText('Consider EVEMS');
  await expect(results).not.toContainText(MIN_WARNING);
  await shot(page, '2-on-qty2');

  // 3 — four chargers: 72 A ÷ 4 = 18.0 A; result card unchanged (#194)
  await quantity.fill('4');
  await expect(results).toContainText('72.0 A shared by 4 chargers: 18.0 A each');
  await expect(results).toContainText('EV Load (setpoint): 17.3 kVA');
  await expect(results).toContainText('Total: 45.6 kVA');
  await expect(results).toContainText('95.0%');
  await expect(results).not.toContainText(MIN_WARNING);
  await shot(page, '3-on-qty4');

  // 4 — six chargers: exactly the 12 A minimum, no warning
  await quantity.fill('6');
  await expect(results).toContainText('72.0 A shared by 6 chargers: 12.0 A each');
  await expect(results).not.toContainText(MIN_WARNING);

  // 5 — seven chargers: 10.3 A each, advisory warning, still compliant
  await quantity.fill('7');
  await expect(results).toContainText('72.0 A shared by 7 chargers: 10.3 A each');
  await expect(results).toContainText(`7 chargers share 10.3 A each, ${MIN_WARNING}`);
  await expect(results).toContainText('supports up to 6 chargers at 12 A');
  await expect(results).toContainText('Compliant');
  await expectMaxCard();
  await shot(page, '5-on-qty7');
});
