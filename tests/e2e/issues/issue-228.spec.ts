import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #228 — the panel schedule pages draw every pole of a multi-pole circuit,
 * list a lug-fed sub-panel under FEED-THRU LUGS (not as an invented breaker),
 * count branch circuits as the app does, and E-601's label separates the
 * panel from its location. Expected values: the issue's Acceptance section.
 * QA project: tests/e2e/fixtures.md. Read-only (generates a packet).
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-228';
mkdirSync(OUT, { recursive: true });
const PROJECT_NAME = 'QA SF subpanel';

test('#228 E-301 draws every pole, lists feed-thru lugs, counts branch circuits', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/permit-packet');

  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000); // the generator reads the project's data after the button renders
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, 'packet.pdf');
  await (await download).saveAs(pdf);

  const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).split('\f');
  expect(pages.length - 1, 'page count unchanged').toBe(14);
  const e301 = pages.find(p => p.includes('PANEL SCHEDULE - Main Panel'))!;
  expect(e301, 'E-301 page').toBeTruthy();

  // 1 — second poles drawn (were blank)
  for (const n of [13, 14, 17, 18]) expect(e301).toContain(`(cont. ckt ${n})`);
  // 2 — the lug-fed sub-panel is listed, not given a breaker slot
  expect(e301).toContain('FEED-THRU LUGS (not breaker-fed)');
  expect(e301).toMatch(/PANEL Garage Subpanel\s+LUG 2P\s+12,330 VA/);
  expect(e301).not.toMatch(/PANEL Garage Subpanel\s+12,330\s+100A/);
  // 3 — branch circuits as the app counts them (was 19)
  expect(e301).toContain('18 (+1 feeder)');
  // 4 — totals unchanged
  expect(e301).toMatch(/48\.6 kVA\s+37\.4 kVA\s+155\.7A/);
  // 5 — E-601 label
  expect(pages.join('')).toContain('"EV CHARGING — GARAGE SUBPANEL (GARAGE) — DO NOT OPERATE UNDER LOAD"');
});
