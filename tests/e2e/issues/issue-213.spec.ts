import { test, expect, Page } from '@playwright/test';

/**
 * #213 — a panel with no branch circuits (an MDP feeding sub-panels) shows
 * 0.0 kVA as its direct load; the feeders' total stays on the feeder card and
 * "Demand with feeders", not repeated as "Direct circuits load". Expected
 * values: the issue's Acceptance section. QA projects: tests/e2e/fixtures.md.
 * Read-only.
 */

async function openMdp(page: Page, projectName: string) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded'); // not networkidle: realtime keeps the dashboard busy; the next step waits for what it needs
  const card = page.getByText(projectName, { exact: true }).first();
  await expect(card, `QA project "${projectName}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/panel');
  const summary = page.locator('h4', { hasText: 'PANEL SUMMARY' }).locator('..');
  await expect(summary).toBeVisible({ timeout: 20_000 });
  return summary;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

for (const [project, feeders, amps] of [
  ['QA EVEMS downstream', '44.1', '183.8'],
  ['QA Feeder sizing', '49.9', '207.8'],
] as const) {
  test(`#213 ${project}: the MDP's direct load is 0, its feeders carry the load`, async ({ page }) => {
    const summary = await openMdp(page, project);
    await expect(summary).toContainText(/DIRECT CIRCUITS LOAD\s*0\.0 KVA/i); // was the feeders' total
    await expect(summary).toContainText(/DIRECT DEMAND LOAD\s*0\.0 KVA/i);
    await expect(summary).toContainText(new RegExp(`FEEDER CIRCUITS \\(2\\)\\s*${feeders.replace('.', '\\.')} KVA`, 'i'));
    await expect(summary).toContainText(new RegExp(`DEMAND WITH FEEDERS\\s*${feeders.replace('.', '\\.')} KVA`, 'i'));
    await expect(summary).toContainText(new RegExp(`DEMAND AMPS\\s*${amps.replace('.', '\\.')} A`, 'i'));
    await expect(page.locator('main')).toContainText('No branch circuits on this panel');
  });
}
