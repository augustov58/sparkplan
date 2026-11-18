import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #179 (PE ruling 2026-11-17) — on a dwelling project, the feeder to a unit
 * panel is the unit page's own Part III load (#155), not the per-type
 * cascade (which counted every 'K' circuit as a range), and a multifamily
 * house panel takes the non-dwelling Part III rules, at the MDP too
 * (220.84(B)). Expected values: the hand calculation in the issue's
 * Acceptance section. QA project: tests/e2e/fixtures.md.
 *
 * Writes: "Recalculate" re-saves F-Unit101's sizing in the QA project. On the
 * fix it saves the same values; run once more on the fix after a run
 * against `main` (which saves the commercial-cascade 36.6 kVA).
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-179';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = 'QA MF feeders';

test('#179 unit-panel feeders and the house panel follow their Part III loads', async ({ page }) => {
  test.setTimeout(120_000);

  // The welcome modal opens while the project list is still loading
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');

  // 1–2 — Feeder Sizing: recalculate F-Unit101 and wait for the save (the card
  // shows the stored value until then)
  await page.goto(`${projectUrl}/feeders`);
  const feederCard = (name: string) =>
    page.locator('h4', { hasText: new RegExp(`^${name}$`) }).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
  await expect(feederCard('F-Unit101')).toBeVisible({ timeout: 20_000 });
  const saved = page.waitForResponse(
    r => r.url().includes('/rest/v1/feeders') && r.request().method() === 'PATCH',
    { timeout: 15_000 },
  );
  await feederCard('F-Unit101').getByTitle('Recalculate').click();
  await saved;
  // 29,700 VA (was 36.6 kVA, commercial cascade); 123.75 A ÷ 0.80 → 2/0
  await expect(feederCard('F-Unit101')).toContainText(/Load:\s*29\.7 kVA/, { timeout: 15_000 });
  await expect(feederCard('F-Unit101')).toContainText(/Phase:\s*2\/0 AWG/);
  await expect(feederCard('F-Unit101')).not.toContainText('exceeds');
  await expect(feederCard('F-House')).toContainText(/Load:\s*19\.3 kVA/);
  await expect(page.locator('main')).not.toContainText('Outdated');
  await shot(page, '1-feeders');

  // 3–4 — Panel Schedule → MDP: feed-thru rows and the 220.84 total
  await page.goto(`${projectUrl}/panel`);
  const summary = page.locator('h4', { hasText: 'PANEL SUMMARY' }).locator('..');
  await expect(summary).toBeVisible({ timeout: 20_000 });
  const main = page.locator('main');
  for (const unit of ['101', '102', '103']) {
    // was 37.1 each (dwelling cascade, "4 ranges")
    await expect(main.locator('tr', { hasText: `→ PANEL Unit ${unit} Panel(Panel)` })).toContainText('29.7');
  }
  await expect(main.locator('tr', { hasText: '→ PANEL House Panel(Panel)' })).toContainText('19.3'); // was 16.6
  await expect(main).toContainText(/FEED-THRU TOTAL:\s*108\.4 kVA/);
  await expect(summary).toContainText(/DEMAND WITH FEEDERS\s*68\.6 KVA/i); // 49,275 + 19,300 (was 67.6)
  await expect(summary).toContainText(/DEMAND AMPS\s*285\.7 A/i);
  await shot(page, '2-mdp');

  // 5 — House Panel: lighting at 100%, not the dwelling tiers
  await main.getByText(/^House Panel\(/).first().click();
  await expect(summary).toContainText(/DIRECT DEMAND LOAD\s*19\.3 KVA/i); // was 16.6
  await expect(summary).toContainText(/DEMAND AMPS\s*80\.4 A/i);
  await shot(page, '3-house');

  // Guardrail — Unit 101's own page is unchanged
  await main.getByText(/^Unit 101 Panel\(/).first().click();
  await expect(summary).toContainText(/DIRECT DEMAND LOAD\s*\(NEC 220 Part III\)\s*29\.7 KVA/i);
});
