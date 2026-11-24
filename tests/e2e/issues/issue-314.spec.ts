import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { restoreMdpAicEmpty, saveMdpAicThroughForm } from './mdpAic';

/**
 * #314 (owner ruling 2026-11-24): the Equipment Specifications form sends an
 * emptied field as null, so "Select AIC rating..." clears a saved rating; and
 * opening the form no longer loops ("Maximum update depth exceeded").
 * Expected values: the issue's Acceptance section (hand-calculated): service
 * fault 8,632 A = 8.6 kA; with no rating the first standard rating ≥ 8.6 kA is
 * 10 kA (#279). The PDF font prints "≥" as ">=".
 *
 * QA project "QA Short circuit" (tests/e2e/fixtures.md), MDP with no AIC
 * rating. The spec sets 42 kA and clears it through the form; if the form
 * leaves a value (main), the restore clears it directly and fails.
 */

const PROJECT = 'QA Short circuit';
const OUT = 'tests/e2e/__output__/screenshots/issue-314';
mkdirSync(OUT, { recursive: true });

async function openProject(page: Page) {
  await page.goto('/');
  const card = page.getByText(PROJECT, { exact: true }).first();
  await expect(card, `QA project "${PROJECT}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

async function openSpecs(page: Page, base: string) {
  await page.goto(base + '/circuits');
  const edit = page.locator('[title="Edit panel"]').first();
  await edit.waitFor({ state: 'attached', timeout: 20_000 });
  await edit.click({ force: true }); // the edit icon shows on hover
  await page.getByRole('button', { name: /Equipment Specifications \(Optional\)/ }).click();
}

/** The one-line's AIC chips after a reload (the rows come back from the database). */
async function aicChips(page: Page, base: string) {
  await page.goto(base + '/diagram');
  await page.reload();
  await expect(page.locator('svg text').filter({ hasText: /^MDP/ }).first()).toBeVisible({ timeout: 20_000 });
  return page.locator('svg text').filter({ hasText: /^AIC / }).allTextContents();
}

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
    e103: flat(pages.find(p => p.includes('Short Circuit Calculation Report'))),
    e201: flat(pages.find(p => p.includes('Riser Diagram') && p.includes('LEGEND'))),
    specs: flat(pages.find(p => p.includes('AIC (kA)') && p.includes('UL Listing'))),
  };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#314 opening Equipment Specifications does not loop', async ({ page }) => {
  const base = await openProject(page);
  const depth: string[] = [];
  page.on('console', m => { if (m.text().includes('Maximum update depth')) depth.push(m.text()); });
  await openSpecs(page, base);
  await page.waitForTimeout(2_000);
  expect(depth, '"Maximum update depth exceeded" on open').toEqual([]); // main: 18
});

test('#314 "Select AIC rating..." clears a saved rating everywhere', async ({ page }) => {
  test.setTimeout(240_000);
  const base = await openProject(page);
  let failure: unknown;
  try {
    // 2: 42 kA → chip
    expect(await saveMdpAicThroughForm(page, base, '42')).toContain('"aic_rating":42');
    expect(await aicChips(page, base)).toEqual(['AIC 42kA']);

    // 3: cleared → the PATCH carries null (main: no aic_rating key)
    expect(await saveMdpAicThroughForm(page, base, '')).toContain('"aic_rating":null');

    // 4: after a reload, no chip; the packet has no rating
    expect(await aicChips(page, base)).toEqual([]); // main: ['AIC 42kA']
    await page.screenshot({ path: join(OUT, 'spec-cleared.png') });
    const p = await packet(page, base, 'packet-cleared');
    expect(p.e201).not.toMatch(/AIC \d+ kA/);
    expect(p.e103).toContain('8.6 10 Required >= 10 kA');
    expect(p.specs).toMatch(/MDP 480V 3Ø 800A — — — — — —/); // AIC (kA) "—"
  } catch (e) {
    failure = e;
  }
  // restore the fixture; report the step that failed first
  try {
    await restoreMdpAicEmpty(page, base, PROJECT);
  } catch (e) {
    if (!failure) throw e;
  }
  if (failure) throw failure;
});

test('#314 an emptied Notes field is cleared', async ({ page }) => {
  const base = await openProject(page);
  const notes = page.locator('textarea[placeholder^="Additional equipment"]');
  const save = async () => {
    const saved = page.waitForResponse(r => r.url().includes('/rest/v1/panels') && r.request().method() === 'PATCH');
    await page.getByRole('button', { name: /Save Changes/ }).click();
    return (await saved).request().postData() ?? '';
  };
  await openSpecs(page, base);
  await notes.fill('QA 314');
  expect(await save()).toContain('"notes":"QA 314"');
  await openSpecs(page, base);
  await expect(notes).toHaveValue('QA 314');
  await notes.fill('');
  expect(await save()).toContain('"notes":null'); // main: ""
  await page.reload();
  await openSpecs(page, base);
  await expect(notes).toHaveValue('');
});
