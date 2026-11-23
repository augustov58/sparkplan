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
 * Since #286 the panel calc takes the feeder's sets, so LP-1 (saved before
 * they were recorded) is Outdated too; #286's spec covers a recomputed panel row.
 *
 * QA project "QA SC saved" (tests/e2e/fixtures.md) holds two rows written
 * with the pre-#258/#276/#279 results: Service Entrance 8,275 A / 14 kA and
 * LP-1 8,402 A / 14 kA; the spec only reads it. Since #285 a service save
 * replaces the project's service row, so steps 7–8 save their 2-set row in
 * "QA Short circuit" and restore its 1-set row (500 kVA, 8,632 A) after.
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-278';
mkdirSync(OUT, { recursive: true });
const PROJECT_NAME = 'QA SC saved';
const SAVE_PROJECT = 'QA Short circuit';

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

/** Tools → Short Circuit → Service Entrance: 480 V 3Φ, 500 kVA, 5.75 %, 100 ft 500 kcmil Cu, steel. */
async function saveService(page: Page, projectUrl: string, sets: string) {
  const main = page.locator('main');
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
  await field('Sets in Parallel').selectOption(sets);
  await field('Conduit Type').selectOption('Steel');
  await field('Conduit Type').blur();
  await expect(main.getByText(/A RMS/).first()).toHaveText(sets === '2' ? /^9,458(\.\d+)? A RMS$/ : /^8,632(\.\d+)? A RMS$/);
  await main.getByRole('button', { name: 'Save to Project' }).first().click();
  const modal = page.locator('div.fixed.inset-0').last();
  await modal.getByRole('button', { name: 'Save Calculation' }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

async function openProject(page: Page, name: string) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(name, { exact: true }).first();
  await expect(card, `QA project "${name}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

test('#278 saved short-circuit results are recomputed; a row that cannot be is flagged Outdated, re-run', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  const projectUrl = await openProject(page, PROJECT_NAME);
  const main = page.locator('main');

  {
    // Steps 1–2: the Short Circuit page
    await page.goto(`${projectUrl}/short-circuit`);
    await expect(main.getByText('2 calculations saved')).toBeVisible({ timeout: 15_000 });
    const text = await main.innerText();
    const svcCard = text.slice(text.indexOf('Add Short Circuit Calculation'), text.indexOf('Panel Calculations'));
    const lp1Card = text.slice(text.indexOf('Panel Calculations'));
    expect(svcCard).toContain('Outdated, re-run.');                  // 1 — main: no flag
    expect(svcCard).toMatch(/Fault:\s*8\.3 kA\s*\(8,275\.\d+ A\)\s*AIC:\s*14 kA/); // stored, not recomputed
    // 2 — since #286 the panel calc takes the feeder's sets, which this row
    // (saved before they were recorded) lacks: Outdated, stored values kept.
    expect(lp1Card).toContain('Outdated, re-run.');
    expect(lp1Card).toMatch(/Fault:\s*8\.4 kA\s*\(8,401\.\d+ A\)\s*AIC:\s*14 kA/);
    await page.screenshot({ path: join(OUT, 'short-circuit-page.png'), fullPage: true });

    // Step 3: LP-1's PDF (the last card's export button)
    const exportButtons = main.locator('button[title="Export to PDF"]');
    const lp1Pdf = join(OUT, 'lp1.pdf');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), exportButtons.last().click()]);
    await dl.saveAs(lp1Pdf);
    const lp1Text = execFileSync('pdftotext', ['-layout', lp1Pdf, '-'], { encoding: 'utf8' });
    expect(lp1Text).toMatch(/Fault Current at Point:\s+8,401\.\d+ A/);
    expect(lp1Text).toContain('OUTDATED');

    // Steps 4–5: the packet
    const pages = await packetPages(page, projectUrl, 'packet-legacy.pdf');
    const afc = pages.find(p => p.includes('Available Fault Current Calculation'))!;
    expect(afc).toMatch(/Available fault current at service main\s+8\.28 kA/);
    expect(afc).toContain('OUTDATED, RE-RUN');                       // 4 — main: no notice
    const e103 = pages.find(p => p.includes('Per-Panel Short Circuit Analysis'))!;
    expect(e103).toMatch(/LP-1\s+Panel\s+10,000[^\n]*\s8\.4\s+14\s+Outdated,/); // 5 — Outdated since #286
    expect(e103).toMatch(/Service Entrance\s+Service[^\n]*\s8\.3\s+14\s+Outdated,/);
    expect(e103).toMatch(/Outdated, re-run:\s+2/);

    // Step 7: a new save records its 2 sets and reads back recomputed with them
    // (in "QA Short circuit": since #285 a save replaces the service row)
  }
  const saveUrl = await openProject(page, SAVE_PROJECT);
  let failure: unknown;
  try {
    await saveService(page, saveUrl, '2');
    // A fresh load (the rows come back from the database), entered from the dashboard
    await openProject(page, SAVE_PROJECT);
    await page.goto(`${saveUrl}/short-circuit`);
    await expect(main.getByText('1 calculation saved')).toBeVisible({ timeout: 15_000 });
    const after = await main.innerText();
    const newCard = after.slice(after.indexOf('Add Short Circuit Calculation'));
    expect(newCard).toMatch(/Fault:\s*9\.5 kA\s*\(9,458\.\d+ A\)\s*AIC:\s*10 kA/); // a guessed 1 set: 8,632 A
    expect(newCard).not.toContain('Outdated');

    // Step 8: E-102 reads the new row
    const pages2 = await packetPages(page, saveUrl, 'packet-after-save.pdf');
    const afc2 = pages2.find(p => p.includes('Available Fault Current Calculation'))!;
    expect(afc2).toMatch(/Available fault current at service main\s+9\.46 kA/);
    expect(afc2).toMatch(/Minimum required AIC rating\s+10 kA/);
    expect(afc2).not.toContain('OUTDATED');
  } catch (e) {
    failure = e;
  }
  // Restore "QA Short circuit": its 1-set row (8,632 A / 10 kA)
  try {
    await saveService(page, saveUrl, '1');
  } catch (e) {
    if (!failure) throw e;
  }
  if (failure) throw failure;
});
