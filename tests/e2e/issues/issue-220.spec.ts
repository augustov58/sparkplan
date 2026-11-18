import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #220 — a multifamily riser draws meter stack → MDP → panels (the MDP is the
 * structural root, ADR-005), so the MDP → panel feeders get their labels and
 * the riser agrees with the feeders and E-301. Expected: the issue's
 * Acceptance section. QA project: "QA MF feeders". Read-only (packet).
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-220';
mkdirSync(OUT, { recursive: true });

test('#220 the multifamily riser has the MDP between the meter stack and the panels', async ({ page }) => {
  test.setTimeout(150_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText('QA MF feeders', { exact: true }).first();
  await expect(card, 'QA project "QA MF feeders" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/permit-packet');
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000);
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, 'packet.pdf');
  await (await download).saveAs(pdf);
  const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).split('\f');
  expect(pages.length - 1).toBe(20);
  const riser = pages.find(p => p.includes('RISER DIAGRAM') && p.includes('UTILITY'))!;
  expect(riser, 'E-201').toBeTruthy();

  // 1 — the MDP sits between the stack and the panels (was missing)
  const at = (s: string) => riser.indexOf(s);
  expect(at('QA MF feeders MDP (MDP)')).toBeGreaterThan(at('CT Cabinet'));
  expect(at('Unit 101 Panel')).toBeGreaterThan(at('QA MF feeders MDP (MDP)'));
  // 2 — the MDP → panel feeders are labelled
  expect(riser).toContain('2/0 AWG Cu • 50 ft • VD 0.47%');
  expect(riser).toContain('1 AWG Cu • 50 ft • VD 0.47%');
  expect(riser).not.toContain('Meter 1: MLO'); // the old stack → panel edges
  // 3 — each panel keeps its meter
  for (const n of [1, 2, 3, 4]) expect(riser).toContain(`Meter ${n}`);
  // 4 — the legend matches the labels
  expect(riser.replace(/\s+/g, ' ')).toContain('Feeder labels show conductor size, length and voltage drop (the design load in kVA when no voltage drop is computed).');
});
