import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #278 — saved short-circuit results are recomputed from their saved inputs
 * with the current calculator; a save that can't be recomputed exactly (a
 * service conductor saved before the sets in parallel were recorded) is
 * flagged "Outdated, re-run" and keeps its stored values. New saves record
 * the sets. Expected values: the issue's Acceptance section (hand-calculated).
 *
 * QA project "QA SC saved" (tests/e2e/fixtures.md) holds two rows written
 * with the pre-#258/#276/#279 results: Service Entrance 8,275 A / 14 kA and
 * LP-1 8,402 A / 14 kA. The spec saves one 2-set service row for steps 7–8
 * and deletes it again (also at the start, if a failed run left it).
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-278';
mkdirSync(OUT, { recursive: true });
const PROJECT_NAME = 'QA SC saved';
const SPEC_NOTE = '#278 spec: 2 sets';

async function packetPages(page: Page, projectUrl: string, name: string): Promise<string[]> {
  await page.goto(`${projectUrl}/permit-packet`);
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000); // the generator reads the project's data after the button renders
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, name);
  await (await download).saveAs(pdf);
  return execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).split('\f');
}

/** Delete the visible service row while it is one this spec saved. */
async function removeSpecRows(page: Page, projectUrl: string) {
  const main = page.locator('main');
  for (let i = 0; i < 3; i++) {
    await page.goto(`${projectUrl}/short-circuit`);
    await expect(main.getByText(/calculations? saved/)).toBeVisible({ timeout: 15_000 });
    const card = main.locator('button[title="Delete calculation"]').first().locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    await card.getByText('Show Details').click();
    if (!(await card.innerText()).includes(SPEC_NOTE)) return;
    await card.locator('button[title="Delete calculation"]').click();
    await page.getByRole('button', { name: /^Delete/ }).last().click();
    await page.waitForTimeout(1_500);
  }
}

test('#278 saved short-circuit results are recomputed; a row that cannot be is flagged Outdated, re-run', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
  const main = page.locator('main');
  await removeSpecRows(page, projectUrl);

  try {
    // Steps 1–2: the Short Circuit page
    await page.goto(`${projectUrl}/short-circuit`);
    await expect(main.getByText('2 calculations saved')).toBeVisible({ timeout: 15_000 });
    const text = await main.innerText();
    const svcCard = text.slice(text.indexOf('Add Short Circuit Calculation'), text.indexOf('Panel Calculations'));
    const lp1Card = text.slice(text.indexOf('Panel Calculations'));
    expect(svcCard).toContain('Outdated, re-run.');                  // 1 — main: no flag
    expect(svcCard).toMatch(/Fault:\s*8\.3 kA\s*\(8,275\.\d+ A\)\s*AIC:\s*14 kA/); // stored, not recomputed
    expect(lp1Card).toMatch(/Fault:\s*8\.5 kA\s*\(8,542\.\d+ A\)\s*AIC:\s*10 kA/); // 2 — main: 8,402 A / 14 kA
    expect(lp1Card).not.toContain('Outdated');
    await page.screenshot({ path: join(OUT, 'short-circuit-page.png'), fullPage: true });

    // Step 3: LP-1's PDF (the last card's export button)
    const exportButtons = main.locator('button[title="Export to PDF"]');
    const lp1Pdf = join(OUT, 'lp1.pdf');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), exportButtons.last().click()]);
    await dl.saveAs(lp1Pdf);
    const lp1Text = execFileSync('pdftotext', ['-layout', lp1Pdf, '-'], { encoding: 'utf8' });
    expect(lp1Text).toMatch(/Fault Current at Point:\s+8,542\.\d+ A/);
    expect(lp1Text).toMatch(/REQUIRED AIC RATING[\s\S]{0,200}\b10 kA/);

    // Steps 4–5: the packet
    const pages = await packetPages(page, projectUrl, 'packet-legacy.pdf');
    const afc = pages.find(p => p.includes('Available Fault Current Calculation'))!;
    expect(afc).toMatch(/Available fault current at service main\s+8\.28 kA/);
    expect(afc).toContain('OUTDATED, RE-RUN');                       // 4 — main: no notice
    const e103 = pages.find(p => p.includes('Per-Panel Short Circuit Analysis'))!;
    expect(e103).toMatch(/LP-1\s+Panel\s+10,000[^\n]*\s8\.5\s+10\s+Compliant/); // 5 — main: 8.4 / 14
    expect(e103).toMatch(/Service Entrance\s+Service[^\n]*\s8\.3\s+14\s+Outdated,/);
    expect(e103).toMatch(/Outdated, re-run:\s+1/);

    // Step 7: a new save records its 2 sets and reads back recomputed with them
    await page.goto(`${projectUrl}/tools`);
    await main.getByRole('button', { name: 'Short Circuit (NEC 110.9)' }).first().click();
    const field = (label: string) => main.locator('label.label-xs', { hasText: label }).locator('xpath=..').locator('input,select').first();
    await main.getByRole('button', { name: 'Service Entrance' }).first().click();
    await field('Service Voltage').selectOption('480');
    await field('Service Phase').selectOption('3');
    await field('Transformer kVA').fill('500');
    await field('Impedance (%)').fill('5.75');
    await field('Conductor Length (ft)').fill('100');
    await field('Conductor Size').selectOption('500 kcmil');
    await field('Material').selectOption('Cu');
    await field('Sets in Parallel').selectOption('2');
    await field('Conduit Type').selectOption('Steel');
    await field('Conduit Type').blur();
    await expect(main.getByText(/A RMS/).first()).toHaveText(/^9,458(\.\d+)? A RMS$/);
    await main.getByRole('button', { name: 'Save to Project' }).first().click();
    const modal = page.locator('div.fixed.inset-0').last();
    await modal.locator('textarea').fill(SPEC_NOTE);
    await modal.getByRole('button', { name: 'Save Calculation' }).click();
    await expect(modal).toBeHidden({ timeout: 15_000 });

    await page.reload();
    await page.goto(`${projectUrl}/short-circuit`);
    await expect(main.getByText('3 calculations saved')).toBeVisible({ timeout: 15_000 });
    const after = await main.innerText();
    const newCard = after.slice(after.indexOf('Add Short Circuit Calculation'), after.indexOf('Panel Calculations'));
    expect(newCard).toMatch(/Fault:\s*9\.5 kA\s*\(9,458\.\d+ A\)\s*AIC:\s*10 kA/); // a guessed 1 set: 8,632 A
    expect(newCard).not.toContain('Outdated');

    // Step 8: E-102 reads the new row
    const pages2 = await packetPages(page, projectUrl, 'packet-after-save.pdf');
    const afc2 = pages2.find(p => p.includes('Available Fault Current Calculation'))!;
    expect(afc2).toMatch(/Available fault current at service main\s+9\.46 kA/);
    expect(afc2).toMatch(/Minimum required AIC rating\s+10 kA/);
    expect(afc2).not.toContain('OUTDATED');
  } finally {
    await removeSpecRows(page, projectUrl);
  }
});
