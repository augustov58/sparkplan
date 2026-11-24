import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #301 (owner ruling 2026-11-23, c): E-102 "Service Rating" is the project's
 * rating (its service amps, else the MDP main), both Short Circuit calculators
 * prefill from the project, and a service row whose utility transformer was
 * estimated from other amps than the project's rating is "Stale, re-run" in
 * the app and on the packet. Expected values: the issue's Acceptance section
 * (hand-calculated, 480 V 3Φ, 5.75 % Z, 100 ft 500 kcmil Cu, 1 set, steel):
 *   500 kVA entered       →  8,632 A / 10 kA (the fixture row)
 *   estimated from 200 A  →  4,297 A / 10 kA (source 4,707 A)
 *   estimated from 800 A  → 11,908 A / 14 kA (source 15,689 A)
 *
 * QA project "QA Short circuit" (tests/e2e/fixtures.md): project service amps
 * empty, MDP main 800 A; its service row has 500 kVA entered and 200 A in the
 * amps field. The spec saves the 200 A and 800 A estimates from Tools and always
 * restores that row on the Short Circuit page.
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-301';
mkdirSync(OUT, { recursive: true });
const PROJECT_NAME = 'QA Short circuit';

const field = (page: Page, label: string) =>
  page.locator('main').locator('label', { hasText: label }).locator('xpath=..').locator('input,select').first();

/** Tools → Short Circuit → Service Entrance: the prefilled service inputs. */
async function openToolsService(page: Page, projectUrl: string) {
  const main = page.locator('main');
  await page.goto(`${projectUrl}/tools`);
  await main.getByRole('button', { name: 'Short Circuit (NEC 110.9)' }).first().click();
  await main.getByRole('button', { name: 'Service Entrance' }).first().click();
  await expect(field(page, 'Service Amps')).toHaveValue('800', { timeout: 15_000 }); // main: 200
  return {
    voltage: await field(page, 'Service Voltage').inputValue(),
    phase: await field(page, 'Service Phase').inputValue(),
    kva: await field(page, 'Transformer kVA').inputValue(),
    impedance: await field(page, 'Impedance (%)').inputValue(),
  };
}

/** Fill the service conductors in Tools and save; the result text before saving. */
async function saveToolsService(page: Page, amps?: string) {
  const main = page.locator('main');
  if (amps) await field(page, 'Service Amps').fill(amps);
  await field(page, 'Conductor Length (ft)').fill('100');
  await field(page, 'Conductor Size').selectOption('500 kcmil');
  await field(page, 'Material').selectOption('Cu');
  await field(page, 'Sets in Parallel').selectOption('1');
  await field(page, 'Conduit Type').selectOption('Steel');
  await field(page, 'Conduit Type').blur();
  const result = (await main.innerText()).replace(/\s+/g, ' ');
  await main.getByRole('button', { name: 'Save to Project' }).first().click();
  const modal = page.locator('div.fixed.inset-0').last();
  await modal.getByRole('button', { name: 'Save Calculation' }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
  return result;
}

/** The Short Circuit page's text once it shows `until` (the list refetches after a save). */
async function scPage(page: Page, projectUrl: string, until: RegExp) {
  const main = page.locator('main');
  await page.goto(`${projectUrl}/short-circuit`);
  const text = async () => (await main.innerText()).replace(/\s+/g, ' ');
  await expect.poll(text, { timeout: 20_000 }).toMatch(until);
  return text();
}

async function packetPages(page: Page, projectUrl: string, name: string) {
  await page.goto(`${projectUrl}/permit-packet`);
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
    e102: flat(pages.find(p => p.includes('Available Fault Current Calculation'))),
    e103: flat(pages.find(p => p.includes('Short Circuit Calculation Report'))),
  };
}

/** Steps 4 + 9: delete the service card, read the page's prefill, save the 500 kVA fixture row. */
async function restoreOnScPage(page: Page, projectUrl: string) {
  const main = page.locator('main');
  await scPage(page, projectUrl, /\d+ calculations? saved/);
  const del = main.locator('[title="Delete calculation"]');
  while (await del.count() > 0) {
    await del.first().click({ force: true });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(main.getByText('0 calculations saved')).toBeVisible({ timeout: 15_000 });
  }
  const add = main.getByRole('button', { name: 'Add Short Circuit Calculation' });
  if (await add.isVisible()) await add.click();
  await main.getByRole('button', { name: 'Service Entrance' }).first().click();
  // The rating comes from the panels (the MDP main), which load after the form
  // seeds 200; wait for it before reading (#317). main: 200
  await expect(field(page, 'Service Amps')).toHaveValue('800', { timeout: 15_000 });
  const prefillAmps = await field(page, 'Service Amps').inputValue();
  // The fixture as it was found: 200 A typed in the amps field beside the
  // utility's 500 kVA (the amps don't enter a result with a kVA, so it is not
  // Stale; main printed this 200 as E-102's "Service Rating").
  await field(page, 'Service Amps').fill('200');
  await field(page, 'Transformer kVA').fill('500');
  await field(page, 'Impedance (%)').fill('5.75');
  await field(page, 'Length (ft)').fill('100');
  await field(page, 'Size').selectOption('500 kcmil');
  await field(page, 'Material').selectOption('Cu');
  await field(page, 'Conduit').selectOption('Steel');
  const saved = page.waitForResponse(r => r.url().includes('/rest/v1/short_circuit_calculations') && r.request().method() === 'POST');
  await main.getByRole('button', { name: 'Save to Project' }).click();
  expect((await saved).ok()).toBe(true);
  await scPage(page, projectUrl, /1 calculation saved[\s\S]*Fault: 8\.6 kA \(8,632\.\d+ A\) AIC: 10 kA Compliant/);
  return prefillAmps;
}

test('#301 E-102 prints the project rating; an estimate from other amps is Stale', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');

  let restored = false;
  let failure: unknown;
  try {
    // 1–2: the fixture row (500 kVA entered): E-102 prints the project's 800 A, not Stale
    const p1 = await packetPages(page, projectUrl, 'packet-fixture');
    expect(p1.e102).toMatch(/SERVICE RATING SOURCE FAULT CURRENT AVAILABLE AT SERVICE MAIN MIN REQUIRED AIC 800 A 10\.46 kA 8\.63 kA 10 kA/); // main: 200 A
    expect(p1.e102).not.toContain('STALE');

    // 3: Tools prefills from the project
    const prefill = await openToolsService(page, projectUrl);
    expect(prefill).toEqual({ voltage: '480', phase: '3', kva: '', impedance: '5.75' }); // main: 240 / 1 / 2.5

    // 5: 200 A estimated → 4,297 A / 10 kA (source 4,707 A)
    const r200 = await saveToolsService(page, '200');
    expect(r200).toMatch(/SERVICE FAULT CURRENT 4\.3 kA 4,297\.\d+ A RMS Required AIC: 10 kA/);
    expect(r200).toMatch(/Source If: 4,706\.\d+ A/);

    // 6: the Short Circuit page marks it Stale
    const s6 = await scPage(page, projectUrl, /Fault: 4\.3 kA/);
    expect(s6).toContain("Stale — service rating changed: the utility transformer was estimated from a 200 A service; the project's service rating is 800 A (11,908 A at the service main)");
    expect(s6).toMatch(/Fault: 4\.3 kA \(4,297\.\d+ A\) AIC: 10 kA Stale, re-run/);
    await page.screenshot({ path: join(OUT, 'spec-stale.png'), fullPage: true });

    // 7: E-102 (800 A + Stale) and E-103 (row and summary)
    const p7 = await packetPages(page, projectUrl, 'packet-stale');
    expect(p7.e102).toMatch(/MIN REQUIRED AIC 800 A 4\.71 kA 4\.30 kA 10 kA/);
    expect(p7.e102).toContain('STALE, RE-RUN Service rating changed: the utility transformer was estimated from a 200 A service');
    expect(p7.e103).toMatch(/Stale, re-run: 1/);
    expect(p7.e103).toMatch(/Service Entrance Service 4,707 500 kcmil Cu · 100 ft 480V 3Ø 0\.0645 4\.3 10 Stale, re-run/); // #307: whole-amp Source If

    // 8: re-run with the prefilled 800 A → 11,908 A / 14 kA (source 15,689 A), not Stale
    await openToolsService(page, projectUrl);
    const r800 = await saveToolsService(page);
    expect(r800).toMatch(/SERVICE FAULT CURRENT 11\.9 kA 11,908\.\d+ A RMS Required AIC: 14 kA/);
    expect(r800).toMatch(/Source If: 15,688\.\d+ A/);
    const s8 = await scPage(page, projectUrl, /Fault: 11\.9 kA/);
    expect(s8).toMatch(/Fault: 11\.9 kA \(11,908\.\d+ A\) AIC: 14 kA Compliant/);
    expect(s8).not.toContain('Stale');

    // 4 + 9: the page's own calculator prefills 800 A; restore the fixture with it
    const pagePrefill = await restoreOnScPage(page, projectUrl);
    restored = true;
    expect(pagePrefill).toBe('800'); // main: 200
  } catch (e) {
    failure = e;
  }
  // Restore the fixture; report the first failure, not a failed restore
  if (!restored) {
    try { await restoreOnScPage(page, projectUrl); } catch (e) { failure ??= e; }
  }
  if (failure) throw failure;
});
