import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #206 (owner rulings 2026-11-24): the Part III aggregate cites the section
 * that sets each 100 % row. Water heater → 220.14(A); heating, nothing
 * omitted → 220.51; cooling, nothing omitted → 220.14(C), 440.6(A);
 * "220.60 (Omit …)" only when a load is omitted. Values unchanged.
 * Expected values: the issue's Acceptance section (hand-calculated).
 *
 * QA projects (tests/e2e/fixtures.md): "QA Commercial panel" (its Unit
 * heaters are re-typed C through the app's Supabase client in the QA session
 * and always put back to H) and "QA Commercial 2023" (read only).
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-206';
mkdirSync(OUT, { recursive: true });

async function openProject(page: Page, name: string) {
  await page.goto('/');
  const card = page.getByText(name, { exact: true }).first();
  await expect(card, `QA project "${name}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

/** Sets Unit heater 1–4's load types in "QA Commercial panel"; returns rows changed. */
async function setHeaterTypes(page: Page, types: string[]) {
  const n = await page.evaluate(async (types) => {
    // @ts-expect-error — served by the Vite dev server
    const { supabase } = await import('/lib/supabase.ts');
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email !== 'augustovalbuena+qa@gmail.com') throw new Error('not the QA account');
    const { data: proj } = await supabase.from('projects').select('id').eq('name', 'QA Commercial panel').single();
    let changed = 0;
    for (let i = 0; i < types.length; i++) {
      const { data, error } = await supabase.from('circuits').update({ load_type: types[i] })
        .eq('project_id', proj.id).eq('description', `Unit heater ${i + 1}`).select('id');
      if (error) throw new Error(error.message);
      changed += data.length;
    }
    return changed;
  }, types);
  expect(n, 'Unit heater 1–4').toBe(4);
}

/**
 * The MDP demand table's rows once `ready` shows. Realtime delivers each of the
 * four re-typings as its own refetch, so `ready` is the expected row's full
 * values, never a prefix an in-between state also matches (#317).
 */
async function demandRows(page: Page, base: string, ready: RegExp) {
  await page.goto(base + '/panel');
  const table = page.locator('span', { hasText: 'DEMAND FACTOR CALCULATION' }).locator('xpath=ancestor::div[.//table][1]').locator('table');
  const rows = async () => (await table.locator('tbody tr').allInnerTexts()).map(r => r.replace(/\s+/g, ' ')).join('\n');
  await expect.poll(rows, { timeout: 20_000 }).toMatch(ready);
  return rows();
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#206 Panel Schedule demand rows cite 220.14(A), 220.51, 220.14(C)/440.6(A); 220.60 only when omitting', async ({ page }) => {
  test.setTimeout(120_000);
  const base = await openProject(page, 'QA Commercial panel');
  let failure: unknown;
  try {
    // 1–2: as stored
    let rows = await demandRows(page, base, /Water Heater 4\.50/);
    expect(rows).toContain('Water Heater 4.50 1.00 4.50 220.14(A) (Specific Appliances or Loads)'); // main: 220.51 (Fixed Appliances)
    expect(rows).toContain('HVAC - Heating (larger) 12.00 1.00 12.00 220.51 (Fixed Electric Space Heating)'); // main: 220.60 (Omit 0.0kVA cooling)
    expect(rows).not.toContain('Omit 0.0');
    await page.screenshot({ path: join(OUT, 'spec-stored.png'), fullPage: true });

    // 3: Unit heater 4 as cooling → 3.0 kVA omitted
    await setHeaterTypes(page, ['H', 'H', 'H', 'C']);
    rows = await demandRows(page, base, /HVAC - Heating \(larger\) 12\.00 0\.75 9\.00/);
    expect(rows).toContain('HVAC - Heating (larger) 12.00 0.75 9.00 220.60 (Omit 3.0kVA cooling)');

    // 4: all four as cooling, nothing omitted
    await setHeaterTypes(page, ['C', 'C', 'C', 'C']);
    rows = await demandRows(page, base, /HVAC - Cooling \(larger\) 12\.00 1\.00 12\.00/);
    expect(rows).toContain('HVAC - Cooling (larger) 12.00 1.00 12.00 220.14(C), 440.6(A) (Air-Conditioning)'); // main: 220.60 (Omit 0.0kVA heating)
  } catch (e) {
    failure = e;
  }
  try {
    await setHeaterTypes(page, ['H', 'H', 'H', 'H']);
  } catch (e) {
    if (!failure) throw e;
  }
  if (failure) throw failure;
  const restored = await demandRows(page, base, /HVAC - Heating \(larger\) 12\.00 1\.00 12\.00/);
  expect(restored).toContain('220.51 (Fixed Electric Space Heating)');
});

test('#206 NEC 2023: the same citations in the app and on the packet', async ({ page }) => {
  test.setTimeout(180_000);
  const base = await openProject(page, 'QA Commercial 2023');
  const rows = await demandRows(page, base, /Water Heater 4\.50/);
  expect(rows).toContain('Water Heater 4.50 1.00 4.50 220.14(A) (Specific Appliances or Loads)');
  expect(rows).toContain('HVAC - Heating (larger) 12.00 1.00 12.00 220.51 (Fixed Electric Space Heating)');

  await page.goto(base + '/permit-packet');
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000); // the generator reads the project's data after the button renders
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, 'packet-2023.pdf');
  await (await download).saveAs(pdf);
  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }).replace(/\s+/g, ' ');
  expect(text).toContain('220.14(A)');
  expect(text).toContain('220.51 (Fixed Electric Space Heating)');
  expect(text).not.toContain('Fixed Appliances'); // main
  expect(text).not.toContain('Omit 0.0'); // main
});
