import { test, expect } from '@playwright/test';

/**
 * #218 — non-dwelling lighting cites "Table 220.42 (All others)", the table's
 * catch-all row (100%); there is no "Office Buildings" row. Label only: the
 * values don't change. Expected values: the issue's Acceptance section.
 * QA projects: tests/e2e/fixtures.md. Read-only.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

for (const [project, panel, lighting, demand] of [
  ['QA EVEMS downstream', 'Office Panel', '6.00', '13.5'],
  ['QA Commercial panel', 'MDP', '3.00', '21.3'],
  ['QA MF feeders', 'House Panel', '7.20', '19.3'],
] as const) {
  test(`#218 ${project} → ${panel}: lighting cites Table 220.42 (All others)`, async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const card = page.getByText(project, { exact: true }).first();
    await expect(card, `QA project "${project}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
    await card.click();
    await page.waitForURL(/#\/project\/[^/]+/);
    await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/panel');
    const summary = page.locator('h4', { hasText: 'PANEL SUMMARY' }).locator('..');
    await expect(summary).toBeVisible({ timeout: 20_000 });
    const tab = page.locator('main button', { hasText: new RegExp('^' + panel) }).first();
    if (await tab.count()) await tab.click();

    const main = page.locator('main');
    const row = new RegExp(`Lighting\\s*${lighting.replace('.', '\\.')}\\s*1\\.00\\s*${lighting.replace('.', '\\.')}\\s*Table 220\\.42 \\(All others\\)`);
    await expect(main).toContainText(row, { timeout: 15_000 }); // was "(Office Buildings)"
    await expect(main).not.toContainText('Office Buildings');
    await expect(summary).toContainText(new RegExp(`DIRECT DEMAND LOAD\\s*${demand.replace('.', '\\.')} KVA`, 'i')); // unchanged
  });
}
