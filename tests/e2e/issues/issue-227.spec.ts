import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #227 — a new single-family house prints the 230.42(A)(1) service check
 * (Article 220 load + 25% of the continuous loads, PE ruling #192) in the
 * Dwelling Load Calculator and on E-101. "QA SF subpanel": 37,375 VA +
 * 25% × 7,680 VA = 39,295 VA = 164 A on 200 A. Read-only (generates a packet).
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-227';
mkdirSync(OUT, { recursive: true });

test('#227 a new house shows its service check (calculator and E-101)', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText('QA SF subpanel', { exact: true }).first();
  await expect(card, 'QA project "QA SF subpanel" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');

  // 1 — Dwelling Load Calculator
  await page.goto(`${projectUrl}/load-calc`);
  const main = page.locator('main');
  await expect(main).toContainText(/Service Current\s*156A/, { timeout: 20_000 });
  await expect(main).toContainText(/Service Check \(NEC 230\.42\(A\)\(1\)\)\s*load \+ 25% of the continuous loads\s*164A/); // was not shown
  await expect(main).toContainText(/Recommended Service\s*200A/);

  // 2 — E-101
  await page.goto(`${projectUrl}/permit-packet`);
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000);
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, 'packet.pdf');
  await (await download).saveAs(pdf);
  const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).split('\f');
  expect(pages.length - 1).toBe(14);
  const e101 = pages.find(p => p.includes('LOAD CALCULATION') && p.includes('E-101'))!;
  expect(e101).toContain('Service check (NEC 230.42(A)(1)): 164 A on the 200 A service (the NEC 220 load + 25% of the continuous loads) — sufficient.');
  expect(e101).toMatch(/37\.38 kVA\s+156 A/);
});
