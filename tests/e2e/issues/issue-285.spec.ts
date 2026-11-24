import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #285 (owner ruling 2026-11-22, a): one service short-circuit calculation per
 * project. A new save replaces the previous one, and the Short Circuit page,
 * E-102 and the packet's short-circuit table show the same single row.
 * Expected values: the issue's Acceptance section (hand-calculated):
 * 500 kVA → 8,632 A / 10 kA; 750 kVA → 11,908 A / 14 kA (480 V 3Φ, 5.75 %,
 * 100 ft 500 kcmil Cu, 1 set, steel).
 *
 * QA project "QA Short circuit" (tests/e2e/fixtures.md) keeps one 500 kVA row;
 * the spec saves 750 kVA and then the 500 kVA inputs again (fixture restored).
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-285';
mkdirSync(OUT, { recursive: true });
const PROJECT_NAME = 'QA Short circuit';

async function saveService(page: Page, projectUrl: string, kva: string) {
  const main = page.locator('main');
  await page.goto(`${projectUrl}/tools`);
  await main.getByRole('button', { name: 'Short Circuit (NEC 110.9)' }).first().click();
  const field = (label: string) => main.locator('label.label-xs', { hasText: label }).locator('xpath=..').locator('input,select').first();
  await main.getByRole('button', { name: 'Service Entrance' }).first().click();
  await field('Service Voltage').selectOption('480');
  await field('Service Phase').selectOption('3');
  await field('Transformer kVA').fill(kva);
  await field('Impedance (%)').fill('5.75');
  await field('Conductor Length (ft)').fill('100');
  await field('Conductor Size').selectOption('500 kcmil');
  await field('Material').selectOption('Cu');
  await field('Sets in Parallel').selectOption('1');
  await field('Conduit Type').selectOption('Steel');
  await field('Conduit Type').blur();
  await main.getByRole('button', { name: 'Save to Project' }).first().click();
  const modal = page.locator('div.fixed.inset-0').last();
  await modal.getByRole('button', { name: 'Save Calculation' }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

async function serviceCards(page: Page, projectUrl: string) {
  const main = page.locator('main');
  await page.goto(`${projectUrl}/short-circuit`);
  await expect(main.getByText(/calculations? saved/)).toBeVisible({ timeout: 15_000 });
  return (await main.innerText()).replace(/\s+/g, ' ');
}

test('#285 one service short-circuit calculation: a new save replaces it everywhere', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');

  let failure: unknown;
  try {
    // 1–2: save 750 kVA; the page holds one calculation
    await saveService(page, projectUrl, '750');
    const text = await serviceCards(page, projectUrl);
    expect(text).toContain('1 calculation saved'); // main: 2 calculations saved
    expect(text).toMatch(/Service Entrance \d+\/\d+\/\d+ Fault: 11\.9 kA \(11,908\.\d+ A\) AIC: 14 kA/);

    // 3–4: the packet prints that one row
    await page.goto(`${projectUrl}/permit-packet`);
    const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
    await expect(generate).toBeEnabled({ timeout: 20_000 });
    await page.waitForTimeout(2_000); // the generator reads the project's data after the button renders
    const download = page.waitForEvent('download', { timeout: 120_000 });
    await generate.click();
    const pdf = join(OUT, 'packet.pdf');
    await (await download).saveAs(pdf);
    const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).split('\f');
    const afc = pages.find(p => p.includes('Available Fault Current Calculation'))!;
    expect(afc).toMatch(/Available fault current at service main\s+11\.91 kA/);
    expect(afc).toMatch(/Minimum required AIC rating\s+14 kA/);
    const table = pages.find(p => p.includes('Per-Panel Short Circuit Analysis'))!;
    expect(table.match(/^\s*Service Entrance\s+Service/gm)).toHaveLength(1); // main: 2 rows
    expect(table).toMatch(/Service Entrance\s+Service[^\n]*\s11\.9\s+14\s+Required >= 14 kA/); // #307: no rating entered
    expect(table).toMatch(/Total Panels:\s+1\b/);
    expect(table).toMatch(/Highest Required AIC:\s+14 kA/);
  } catch (e) {
    failure = e;
  }
  // 5: restore the fixture (500 kVA); on main this adds a row instead of replacing it
  try {
    await saveService(page, projectUrl, '500');
  } catch (e) {
    if (!failure) throw e;
  }
  if (failure) throw failure;
  const restored = await serviceCards(page, projectUrl);
  expect(restored).toContain('1 calculation saved');
  expect(restored).toMatch(/Service Entrance \d+\/\d+\/\d+ Fault: 8\.6 kA \(8,632\.\d+ A\) AIC: 10 kA/);
});
