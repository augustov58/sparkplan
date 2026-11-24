import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #286 — the downstream (panel) short-circuit calculation divides the feeder's
 * impedance by its sets in parallel (owner OK 2026-11-22). Expected values:
 * the issue's Acceptance section, hand-calculated.
 *
 * QA project "QA SC parallel" (tests/e2e/fixtures.md): service 1,000 kVA,
 * 5.75 %, 480 V 3Φ, 20 ft 500 kcmil Cu × 3, steel → 20,344 A at the MDP; DP-1
 * fed by "MDP → DP-1" (100 ft, 2 sets). The spec deletes DP-1's saved row,
 * calculates it again (4/0 Cu, steel) and saves it, which is the fixture's
 * state.
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-286';
mkdirSync(OUT, { recursive: true });
const PROJECT_NAME = 'QA SC parallel';
const DP1 = 'DP-1 (400A, 480V)';

async function openProject(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

const faultText = async (page: Page) =>
  ((await page.locator('main').innerText()).replace(/\s+/g, ' ').match(/PANEL FAULT CURRENT.{0,60}/)?.[0] ?? '');

test('#286 a feeder\'s sets in parallel reach the panel short-circuit calculation', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  const projectUrl = await openProject(page);
  const main = page.locator('main');

  // Start from no DP-1 row (the fixture keeps one; a failed run may too)
  await page.goto(`${projectUrl}/short-circuit`);
  await expect(main.getByText(/calculations? saved/)).toBeVisible({ timeout: 15_000 });
  const deletes = main.locator('button[title="Delete calculation"]');
  for (let i = 0; i < await deletes.count(); i++) {
    const card = deletes.nth(i).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    if (!(await card.innerText()).includes('DP-1')) continue;
    await deletes.nth(i).click();
    await page.getByRole('button', { name: /^Delete/ }).last().click();
    await expect(main.getByText('1 calculation saved')).toBeVisible({ timeout: 15_000 });
    break;
  }

  // 1: the service row
  const text = (await main.innerText()).replace(/\s+/g, ' ');
  expect(text).toMatch(/Service Entrance \d+\/\d+\/\d+ Fault: 20\.3 kA \(20,344\.\d+ A\) AIC: 22 kA/);

  // 2: DP-1, prefilled from its feeder (2 sets) and the panel (480 V 3φ); 4/0 Cu in steel
  if (!(await main.getByText('New Calculation').isVisible())) {
    await main.getByRole('button', { name: /Add Short Circuit Calculation/ }).first().click();
  }
  await main.getByRole('button', { name: 'Downstream Panel' }).click();
  await main.getByRole('combobox').first().selectOption({ label: DP1 });
  const values = () => main.locator('input, select').evaluateAll(els =>
    els.map(e => (e instanceof HTMLSelectElement ? e.options[e.selectedIndex]?.text : (e as HTMLInputElement).value)));
  await expect.poll(values).toEqual([DP1, '100', expect.any(String), '2', 'Copper', expect.any(String), '480V', '3φ']); // main: 1φ
  const selects = main.locator('select');
  for (let i = 0; i < await selects.count(); i++) {
    const options = await selects.nth(i).locator('option').allTextContents();
    if (options.includes('4/0 AWG')) await selects.nth(i).selectOption({ label: '4/0 AWG' });
    else if (options.includes('PVC')) await selects.nth(i).selectOption({ label: 'Steel' });
  }
  await expect.poll(() => faultText(page)).toMatch(/15\.7 kA 15,679 A RMS Required AIC: 22 kA/); // main: 12,755 A / 14 kA
  await page.screenshot({ path: join(OUT, 'two-sets.png'), fullPage: true });

  // 3: one set
  const sets = main.locator('input[type=number]').nth(1);
  await sets.fill('1');
  await expect.poll(() => faultText(page)).toMatch(/12\.8 kA 12,755 A RMS Required AIC: 14 kA/);
  await sets.fill('2');
  await expect.poll(() => faultText(page)).toMatch(/15,679 A RMS/);

  // 4: saved with 2 sets, read back from the database
  await main.getByRole('button', { name: 'Save to Project' }).click();
  await expect(main.getByText('2 calculations saved')).toBeVisible({ timeout: 15_000 });
  await openProject(page);
  await page.goto(`${projectUrl}/short-circuit`);
  await expect(main.getByText('2 calculations saved')).toBeVisible({ timeout: 15_000 });
  const after = (await main.innerText()).replace(/\s+/g, ' ');
  const card = after.slice(after.indexOf('Panel Calculations'));
  expect(card).toMatch(/DP-1 \(400A, 480V\) \d+\/\d+\/\d+ Fault: 15\.7 kA \(15,679\.\d+ A\) AIC: 22 kA/);
  expect(card).not.toContain('Outdated');

  // 5: the packet's short-circuit table
  await page.goto(`${projectUrl}/permit-packet`);
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000); // the generator reads the project's data after the button renders
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, 'packet.pdf');
  await (await download).saveAs(pdf);
  const pages = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).split('\f');
  const table = pages.find(p => p.includes('Per-Panel Short Circuit Analysis'))!;
  expect(table).toMatch(/DP-1\s+Panel\s+20,344\s[^\n]*\s15\.7\s+22\s+Required >= 22 kA/); // #307: whole-amp Source If, no rating entered
});
