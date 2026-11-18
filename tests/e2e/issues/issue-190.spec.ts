import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #190 (PE ruling 2026-11-17) — feeder design load = Article 220 demand + 25%
 * of the continuous loads on the feeder (EV charging, signs, show windows),
 * not a blanket 1.20 × demand. The dead "Continuous Load Percentage" slider
 * is gone. Expected values: the hand calculation in the issue's Acceptance.
 * QA project: tests/e2e/fixtures.md.
 *
 * Writes: "Recalculate" re-saves each feeder's sizing in the QA project. On
 * the fix it saves the same values; run once more on the fix after a run
 * against `main` (which saves the old 1.20 × values).
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-190';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = 'QA Feeder sizing';

test('#190 feeders sized at demand + 25% of the continuous loads', async ({ page }) => {
  test.setTimeout(90_000);

  // The welcome modal opens while the project list is still loading
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded'); // not networkidle: realtime keeps the dashboard busy; the next step waits for what it needs
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/feeders'));

  const feederCard = (name: string) =>
    page.locator('h4', { hasText: new RegExp(`^${name}$`) }).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
  // Wait for the save: the card shows the stored value until then, so an
  // assertion before it would pass on the old rule too
  const recalc = async (name: string, expected: RegExp) => {
    const saved = page.waitForResponse(
      r => r.url().includes('/rest/v1/feeders') && r.request().method() === 'PATCH',
      { timeout: 15_000 },
    );
    await feederCard(name).getByTitle('Recalculate').click();
    await saved;
    await expect(feederCard(name)).toContainText(expected, { timeout: 15_000 });
  };

  // 1–2 — recalculate both feeders with the current rule
  await expect(feederCard('F-EV')).toBeVisible({ timeout: 15_000 });
  await recalc('F-EV', /Load:\s*45\.0 kVA/); // 36,360 + 25% × 34,560 (was 43.6 = 1.20 ×)
  await recalc('F-Office', /Load:\s*13\.9 kVA/); // 13,500 + 25% × 1,500 (was 16.2)
  await expect(feederCard('F-EV')).toContainText(/Phase:\s*250 kcmil/); // 187.5 A ÷ 0.80 = 234.4 A
  await expect(feederCard('F-Office')).toContainText(/Phase:\s*3 AWG/);
  await expect(page.locator('main')).not.toContainText('Outdated');
  await expect(page.locator('main')).not.toContainText('Need Recalculation');
  await shot(page, '2-recalculated');

  // 3 — the advanced options name the continuous loads; no percentage slider
  await page.getByRole('button', { name: 'Add Feeder' }).click();
  await page.getByRole('button', { name: /Advanced Calculation Options/ }).click();
  await expect(page.locator('main input[type=range]')).toHaveCount(0);
  await expect(page.locator('main')).toContainText('EV charging, signs and show windows on this feeder');
  await expect(page.locator('main')).not.toContainText('Continuous Load Percentage');
  await shot(page, '3-advanced');
  await page.getByRole('button', { name: 'Cancel' }).click();
});
