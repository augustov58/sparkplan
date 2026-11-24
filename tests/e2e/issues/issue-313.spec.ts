import { test, expect } from '@playwright/test';
import { restoreMdpAicEmpty, saveMdpAicThroughForm } from './mdpAic';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #313 (owner ruling 2026-11-23): panels.aic_rating is stored in kA. The
 * Equipment Specs form saves 42 for "42 kA"; E-201, the Equipment Specs sheet
 * and the in-app one-line chip printed it as "0.0 kA" (they divided by 1,000).
 *
 * QA project "QA Short circuit" (tests/e2e/fixtures.md). The spec sets the
 * MDP's AIC rating to 42 kA through the form and always puts it back to empty
 * through the form ("Select AIC rating...", which clears it since #314).
 */

const PROJECT = 'QA Short circuit';
const OUT = 'tests/e2e/__output__/screenshots/issue-313';
mkdirSync(OUT, { recursive: true });

test('#313 a 42 kA AIC rating prints as 42 kA on E-201, Equipment Specs and the one-line', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText(PROJECT, { exact: true }).first();
  await expect(card, `QA project "${PROJECT}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const base = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');

  try {
    // 1: MDP → Equipment Specifications → AIC Rating 42 kA → Save Changes
    await saveMdpAicThroughForm(page, base, '42');

    // 2: in-app one-line chip
    await page.goto(base + '/diagram');
    const chip = page.locator('svg text').filter({ hasText: /^AIC / }).first();
    await expect(chip).toHaveText('AIC 42kA', { timeout: 20_000 }); // main: AIC 0.0kA
    await page.screenshot({ path: join(OUT, 'spec-chip.png') });

    // 3: packet — E-201 riser node and the Equipment Specs sheet
    await page.goto(base + '/permit-packet');
    const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
    await expect(generate).toBeEnabled({ timeout: 20_000 });
    await page.waitForTimeout(2_000); // the generator reads the project's data after the button renders
    const download = page.waitForEvent('download', { timeout: 120_000 });
    await generate.click();
    const pdf = join(OUT, 'packet.pdf');
    await (await download).saveAs(pdf);
    const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).split('\f');
    const riser = pages.find(p => p.includes('Riser Diagram') && p.includes('LEGEND'))!;
    expect(riser).toContain('AIC 42 kA'); // main: AIC 0.0 kA
    const specs = pages.find(p => p.includes('AIC (kA)') && p.includes('UL Listing'))!;
    const mdpRow = specs.split('\n').find(l => /^\s*MDP\s/.test(l))!;
    expect(mdpRow).toMatch(/\s42 kA\s/); // main: 0.0 kA
    expect(pages.join('\f')).not.toContain('0.0 kA');
  } finally {
    // 4: restore the fixture (#307 relies on no rating entered)
    await restoreMdpAicEmpty(page, base, PROJECT);
  }
});
