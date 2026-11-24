import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #289 (owner rulings 2026-11-22): the packet's short-circuit table marks a
 * panel row whose upstream changed, as the Short Circuit page does; every
 * surface prints the sets in parallel; the references line names where the
 * service fault current came from; E-102 prints "22 kA". Expected values:
 * the issue's Acceptance section (hand-calculated): 1,000 kVA, 5.75 %,
 * 480 V 3Φ, 20 ft 500 kcmil Cu steel — 3 sets 20,344 A, 2 sets 20,069 A.
 *
 * QA project "QA SC parallel" (tests/e2e/fixtures.md). The spec re-saves the
 * service with 2 sets (DP-1 goes stale) and restores the 3-set row after.
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-289';
mkdirSync(OUT, { recursive: true });
const PROJECT_NAME = 'QA SC parallel';

async function saveService(page: Page, projectUrl: string, sets: string) {
  const main = page.locator('main');
  await page.goto(`${projectUrl}/tools`);
  await main.getByRole('button', { name: 'Short Circuit (NEC 110.9)' }).first().click();
  const field = (label: string) => main.locator('label.label-xs', { hasText: label }).locator('xpath=..').locator('input,select').first();
  await main.getByRole('button', { name: 'Service Entrance' }).first().click();
  await field('Service Amps').fill('1200');
  await field('Service Voltage').selectOption('480');
  await field('Service Phase').selectOption('3');
  await field('Transformer kVA').fill('1000');
  await field('Impedance (%)').fill('5.75');
  await field('Conductor Length (ft)').fill('20');
  await field('Conductor Size').selectOption('500 kcmil');
  await field('Material').selectOption('Cu');
  await field('Sets in Parallel').selectOption(sets);
  await field('Conduit Type').selectOption('Steel');
  await field('Conduit Type').blur();
  await expect(main.getByText(/A RMS/).first()).toHaveText(sets === '2' ? /^20,068\.\d+ A RMS$/ : /^20,344\.\d+ A RMS$/);
  await main.getByRole('button', { name: 'Save to Project' }).first().click();
  const modal = page.locator('div.fixed.inset-0').last();
  await modal.getByRole('button', { name: 'Save Calculation' }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

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

async function shortCircuitText(page: Page, projectUrl: string) {
  const main = page.locator('main');
  await page.goto(`${projectUrl}/short-circuit`);
  await expect(main.getByText('2 calculations saved')).toBeVisible({ timeout: 15_000 });
  for (let i = 0; i < 4 && await main.getByText(/Show Details/).count(); i++) {
    await main.getByText(/Show Details/).first().click();
  }
  return (await main.innerText()).replace(/\s+/g, ' ');
}

test('#289 stale short-circuit rows are marked on the packet; the sets print everywhere', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
  const main = page.locator('main');

  let failure: unknown;
  try {
    // 1: the cards
    const text = await shortCircuitText(page, projectUrl);
    expect(text).toContain('3 × 500 kcmil Cu, 20 ft'); // main: "500 kcmil Cu, 20 ft"
    expect(text).toContain('2 × 4/0 AWG Cu, 100 ft');
    expect(text).not.toContain('Stale');

    // 3: DP-1's own PDF (the last card)
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), main.locator('button[title="Export to PDF"]').last().click()]);
    const dp1Pdf = join(OUT, 'dp1.pdf');
    await dl.saveAs(dp1Pdf);
    expect(execFileSync('pdftotext', ['-layout', dp1Pdf, '-'], { encoding: 'utf8' })).toMatch(/Feeder Conductor:\s+2 × 4\/0 AWG Cu/);

    // 2: the packet
    const pages = await packetPages(page, projectUrl, 'packet.pdf');
    const afc = pages.find(p => p.includes('Available Fault Current Calculation'))!;
    expect(afc).toMatch(/3 × 500 kcmil Cu/);
    expect(afc).toMatch(/\b22 kA/);
    expect(afc).not.toMatch(/22kA/);
    const table = pages.find(p => p.includes('Per-Panel Short Circuit Analysis'))!;
    expect(table).toMatch(/Service Entrance\s+Service\s+[\d,]+\s+3 × 500 kcmil Cu · 20 ft[^\n]*\s20\.3\s+22\s+Required >= 22 kA/); // #307
    expect(table).toMatch(/DP-1\s+Panel\s+20,344\s+2 × 4\/0 AWG Cu · 100 ft[^\n]*\s15\.7\s+22\s+Required >= 22 kA/); // #307
    expect(table).toMatch(/Service fault current calculated from the utility transformer \(1000 kVA, 5\.75 % Z\)/);
    expect(table).not.toMatch(/utility-provided/);

    // 4: the service re-saved with 2 sets → DP-1 stale in the app
    await saveService(page, projectUrl, '2');
    const staleText = await shortCircuitText(page, projectUrl);
    expect(staleText).toContain('Stale — upstream chain changed: was 20,344 A, now 20,069 A');
    expect(staleText).toMatch(/AIC: 22 kA Stale, re-run/); // the card's status, as on the packet (was "Compliant")

    // 5: and on the packet
    const pages2 = await packetPages(page, projectUrl, 'packet-stale.pdf');
    const table2 = pages2.find(p => p.includes('Per-Panel Short Circuit Analysis'))!;
    expect(table2).toMatch(/DP-1\s+Panel\s+20,344\s+2 × 4\/0 AWG Cu · 100 ft[^\n]*\s15\.7\s+22\s+Stale, re-run/); // main: Compliant
    expect(table2).toMatch(/Stale, re-run:\s+1/);
    expect(table2).toMatch(/DP-1: was 20,344 A, now 20,069 A/);
    expect(table2).toMatch(/Service Entrance\s+Service\s+[\d,]+\s+2 × 500 kcmil Cu · 20 ft[^\n]*\s20\.1\s+22\s+Required >= 22 kA/); // #307
  } catch (e) {
    failure = e;
  }
  // 6: restore the 3-set service row (DP-1 fresh again)
  try {
    await saveService(page, projectUrl, '3');
  } catch (e) {
    if (!failure) throw e;
  }
  if (failure) throw failure;
  expect(await shortCircuitText(page, projectUrl)).not.toContain('Stale');
});
