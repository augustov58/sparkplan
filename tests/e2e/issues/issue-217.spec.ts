import { test, expect, type Page } from '@playwright/test';

/**
 * #217 (PE ruling 2026-11-20) — the feeder to a subpanel serving part of a
 * single-family dwelling is NEC 220 Part III over its own circuits: no
 * 2-circuit small-appliance minimum, receptacles at their VA in the Table
 * 220.42 tiers. "QA SF subpanel 217" Pool Subpanel: Lighting 1,500 + Receptacles
 * 1,800 → 3,000 + 35% × 300 = 3,105; Pool Pump 1,800 + 25% = 2,250 → 5,355 VA
 * (the per-type cascade gave 5,550). Read-only.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

async function openProject(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText('QA SF subpanel 217', { exact: true }).first();
  await expect(card, 'QA project "QA SF subpanel 217" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

test('#217 the single-family Pool Subpanel: 5,355 VA by Part III, the same on its page, the feed-thru row and its feeder', async ({ page }) => {
  const project = await openProject(page);
  const main = page.locator('main');

  await page.goto(`${project}/panel`);
  await main.getByText('Pool Subpanel').first().click();
  const summary = page.locator('h4', { hasText: 'PANEL SUMMARY' }).locator('..');
  await expect(summary).toContainText(/DIRECT DEMAND LOAD\s*5\.4 KVA/i, { timeout: 20_000 }); // was 5.5 (cascade 5,550)
  await expect(summary).toContainText(/DEMAND AMPS\s*22\.3 A/i);                         // 5,355 ÷ 240; was 23.1
  await expect(main).toContainText('NEC 220 Part III - Standard Method (Single-Family Subpanel)');
  await expect(main).not.toContainText('NEC 220.44');                                    // the non-dwelling receptacle rule

  await main.getByText('Main Panel').first().click();
  await expect(main.locator('tr', { hasText: 'Pool Subpanel' }).first()).toContainText(/2\.68\s*2\.68\s*5\.4/); // feed-thru row

  await page.goto(`${project}/feeders`);
  await expect(main).toContainText(/Main Panel → Pool Subpanel[\s\S]*Load:\s*5\.4 kVA/, { timeout: 20_000 });
  await expect(main).not.toContainText('Outdated');
});
