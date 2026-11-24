import { test, expect, type Page } from '@playwright/test';
import { mainTextWhen } from './pageText';

/**
 * #291 (owner ruling 2026-11-22, a): the multifamily 220.84 total (MDP) takes
 * each dwelling-unit small-appliance and laundry circuit at 1,500 VA, whatever
 * VA is typed (220.84(C)(2)). Expected values: the issue's Acceptance section
 * (hand-calculated): base 109,500 VA × 45 % = 49,275 + house 19,300 = 68,575 VA
 * → 68.6 kVA, with or without the edits.
 *
 * QA project "QA MF feeders" (tests/e2e/fixtures.md). The spec edits Unit 101's
 * circuits through the app's Supabase client in the QA session (as #282's spec
 * does) and always puts them back to 1,500 VA.
 */

const PROJECT = 'QA MF feeders';

async function setUnit101VA(page: Page, description: string, va: number) {
  const n = await page.evaluate(async ({ description, va }) => {
    // @ts-expect-error — served by the Vite dev server
    const { supabase } = await import('/lib/supabase.ts');
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email !== 'augustovalbuena+qa@gmail.com') throw new Error('not the QA account');
    const { data: proj } = await supabase.from('projects').select('id').eq('name', 'QA MF feeders').single();
    const { data: panel } = await supabase.from('panels').select('id').eq('project_id', proj.id).eq('name', 'Unit 101 Panel').single();
    const { data, error } = await supabase.from('circuits').update({ load_watts: va })
      .eq('project_id', proj.id).eq('panel_id', panel.id).eq('description', description).select('id');
    if (error) throw new Error(error.message);
    return data.length;
  }, { description, va });
  expect(n, `Unit 101 → ${description}`).toBe(1);
}

/**
 * The MDP's "Demand by load type" text, read fresh from the database once it
 * shows `expected`. The heading renders before the circuits load (#317: a
 * one-time read got "TOTAL DEMAND 0.0 kVA"), so it polls for the values.
 */
async function mdpDemand(page: Page, expected: string[]) {
  await page.goto('/');
  await page.reload();
  const card = page.getByText(PROJECT, { exact: true }).first();
  await expect(card, `QA project "${PROJECT}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/panel');
  return mainTextWhen(page, expected);
}

test('#291 the multifamily 220.84 total takes small-appliance / laundry circuits at 1,500 VA each', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  let failure: unknown;
  try {
    // baseline
    await mdpDemand(page, [
      'TOTAL DEMAND 68.6 kVA',
      'Multi-Family Dwelling (3 units) 109.5 kVA → 49.3 kVA (45%)',
    ]);

    // 1: a small-appliance circuit at 2,400 VA → unchanged; 900 VA omitted (main: 110.4 → 49.7; 69.0 kVA)
    await setUnit101VA(page, 'Kitchen Small Appliance #1', 2400);
    await mdpDemand(page, [
      'TOTAL DEMAND 68.6 kVA',
      'Multi-Family Dwelling (3 units) 109.5 kVA → 49.3 kVA (45%)',
      'Small-appliance / laundry circuits above 1,500 VA each (omitted) 0.9 kVA → 0.0 kVA (0%)',
    ]);

    // 2: laundry at 1,200 VA → raised to 1,500 (main: 109.2 → 49.1; 68.4 kVA)
    await setUnit101VA(page, 'Kitchen Small Appliance #1', 1500);
    await setUnit101VA(page, 'Laundry', 1200);
    await mdpDemand(page, [
      'TOTAL DEMAND 68.6 kVA',
      'Multi-Family Dwelling (3 units) 109.2 kVA → 49.1 kVA (45%)',
      'Small-appliance / laundry circuits raised to 1,500 VA each 0.3 kVA → 0.1 kVA (45%)',
    ]);
  } catch (e) {
    failure = e;
  }
  // 3: restore
  try {
    await setUnit101VA(page, 'Kitchen Small Appliance #1', 1500);
    await setUnit101VA(page, 'Laundry', 1500);
  } catch (e) {
    if (!failure) throw e;
  }
  if (failure) throw failure;
  const t = await mdpDemand(page, ['TOTAL DEMAND 68.6 kVA', 'Multi-Family Dwelling (3 units) 109.5 kVA → 49.3 kVA (45%)']);
  expect(t).not.toContain('1,500 VA each');
});
