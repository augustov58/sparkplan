import { test, expect, type Page } from '@playwright/test';
import { restoreMdpAicEmpty, saveMdpAicThroughForm } from './mdpAic';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #307 (owner ruling 2026-11-23, a): no packet page says an equipment
 * interrupting rating is shown or "confirmed" without a comparison. Expected
 * values: the issue's Acceptance section (hand-calculated): source 10,459 A,
 * 8,632 A = 8.6 kA at the service main (the MDP's line-side terminals),
 * required 10 kA. The PDF font prints "≥" as ">=".
 *
 * QA project "QA Short circuit" (tests/e2e/fixtures.md), MDP with no AIC
 * rating. The spec sets 42 kA through the form and always clears it again
 * through the form ("Select AIC rating...", which clears it since #314).
 */

const PROJECT = 'QA Short circuit';
const OUT = 'tests/e2e/__output__/screenshots/issue-307';
mkdirSync(OUT, { recursive: true });

async function packet(page: Page, base: string, name: string) {
  await page.goto(base + '/permit-packet');
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000); // the generator reads the project's data after the button renders
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, `${name}.pdf`);
  await (await download).saveAs(pdf);
  const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).split('\f');
  const flat = (p: string | undefined) => (p ?? '').replace(/\s+/g, ' ');
  return {
    all: flat(pages.join(' ')),
    e102: flat(pages.find(p => p.includes('Available Fault Current Calculation'))),
    e103: flat(pages.find(p => p.includes('Short Circuit Calculation Report'))),
    e201: flat(pages.find(p => p.includes('Riser Diagram') && p.includes('LEGEND'))),
  };
}

test('#307 AIC wording: required when no rating is entered, compared when one is', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText(PROJECT, { exact: true }).first();
  await expect(card, `QA project "${PROJECT}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const base = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');

  try {
    // 1–6: no rating entered
    const p0 = await packet(page, base, 'packet-no-rating');
    expect(p0.e201).toContain('AIC shown where an equipment rating is entered.'); // main: Per-node AIC ratings shown …
    expect(p0.e102).toContain("Equipment interrupting ratings are not entered. Each device's interrupting rating shall be at least the available fault current at its line-side terminals (NEC 110.9); minimum standard rating 10 kA.");
    expect(p0.all).not.toContain('confirmed against'); // main
    expect(p0.e103).toMatch(/Service Entrance Service 10,459 500 kcmil Cu · 100 ft 480V 3Ø 0\.0321 8\.6 10 Required >= 10 kA/); // main: 10,459.244 … Compliant
    expect(p0.e103).toContain('Rating entered, OK (NEC 110.9): 0 (0%) Under-rated: 0 (0%) Rating not entered: 1 (100%)');
    expect(p0.e103).not.toContain('All panels meet NEC 110.9'); // main
    expect(p0.e103).toMatch(/CONTRACTOR .*LICENSE #: EC0000000 .*E-103 Page \d+ of \d+/); // footer (guardrail)
    expect(p0.e102).toContain('800 A 10.46 kA 8.63 kA 10 kA'); // E-102 cards (guardrail)

    // 7–9: MDP → Equipment Specs → AIC 42 kA
    await saveMdpAicThroughForm(page, base, '42');

    const p42 = await packet(page, base, 'packet-42ka');
    expect(p42.e103).toContain('8.6 10 OK (42 >= 8.6 kA)');
    expect(p42.e103).toContain('Rating entered, OK (NEC 110.9): 1 (100%) Under-rated: 0 (0%) Rating not entered: 0 (0%)');
    expect(p42.e102).toContain('Entered ratings compared with the fault current at each point: MDP 42 kA >= 8.6 kA, OK.');
    expect(p42.e102).not.toContain('not entered');
    expect(p42.all).not.toContain('confirmed against');
    expect(p42.e201).toContain('AIC 42 kA');
    expect(p42.e201).toContain('AIC shown where an equipment rating is entered.');
  } finally {
    // 10: restore the fixture (no rating entered)
    await restoreMdpAicEmpty(page, base, PROJECT);
  }
});
