import { test, expect, Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #238 — the Panel Schedule page's "Export PDF" prints the same page as "All
 * Panels" for that panel (demand breakdown, downstream feeds), and both list
 * feeds the way the app and the packet do (#228): lug-fed panels under
 * FEED-THRU LUGS, branch circuits counted apart from feeders. Expected values:
 * the issue's Acceptance section. QA projects: tests/e2e/fixtures.md. Read-only.
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-238';
mkdirSync(OUT, { recursive: true });

async function openSchedule(page: Page, project: string) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(project, { exact: true }).first();
  await expect(card, `QA project "${project}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/panel');
  await expect(page.locator('h4', { hasText: 'PANEL SUMMARY' })).toBeVisible({ timeout: 20_000 });
}

async function exportText(page: Page, button: 'Export PDF' | 'All Panels', file: string): Promise<string[]> {
  await page.waitForTimeout(1_500); // the page computes its aggregates after the summary renders
  const download = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByRole('button', { name: button }).first().click();
  const path = join(OUT, file);
  await (await download).saveAs(path);
  return execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' }).split('\f');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#238 Export PDF carries the demand breakdown (Office Panel)', async ({ page }) => {
  test.setTimeout(90_000);
  await openSchedule(page, 'QA EVEMS downstream');
  await page.locator('main button', { hasText: /^Office Panel/ }).first().click();
  const [p] = await exportText(page, 'Export PDF', 'office-single.pdf');
  // was: no breakdown at all, only "Load Summary & Phase Balance"
  expect(p).toMatch(/Lighting\s+6\.0 kVA\s+6\.0 kVA\s+100%\s+Table 220\.42/);
  expect(p).toMatch(/Receptacles\s+6\.0 kVA\s+6\.0 kVA\s+100%\s+220\.44/);
  expect(p).toMatch(/13\.5 kVA/);
});

test('#238 both exports list the garage subpanel feed (QA SF subpanel Main Panel)', async ({ page }) => {
  test.setTimeout(120_000);
  await openSchedule(page, 'QA SF subpanel');
  const single = (await exportText(page, 'Export PDF', 'sf-single.pdf'))[0]!;
  const all = (await exportText(page, 'All Panels', 'sf-all.pdf')).find(t => t.includes('Main Panel'))!;
  for (const p of [single, all]) {
    expect(p).toContain('FEED-THRU LUGS (not breaker-fed)'); // was: no feed at all
    expect(p).toMatch(/PANEL Garage Subpanel\s+LUG 2P\s+12,330 VA/);
    expect(p).toContain('18 (+1 feeder)'); // was "18"
    expect(p).toMatch(/48\.6 kVA\s+37\.4 kVA\s+155\.7A/);
  }
});

test('#238 All Panels lists lug-fed sub-panels, not invented breakers (QA EVEMS downstream MDP)', async ({ page }) => {
  test.setTimeout(90_000);
  await openSchedule(page, 'QA EVEMS downstream');
  const mdp = (await exportText(page, 'All Panels', 'evems-all.pdf')).find(t => /PANEL SCHEDULE[^\n]*MDP|Panel Name:\s+MDP/.test(t))!;
  expect(mdp).toMatch(/PANEL Office Panel\s+LUG 2P\s+13,500 VA/);
  expect(mdp).toMatch(/PANEL EV Panel\s+LUG 2P\s+30,600 VA/);
  expect(mdp).toContain('0 (+2 feeders)');
  expect(mdp).toMatch(/44\.1 kVA/);
  expect(mdp).not.toMatch(/PANEL Office Panel\s+13,500\s+200A/); // was a 200A 2P breaker in slot 1
});
