import { expect, type Page } from '@playwright/test';

/**
 * The MDP's AIC rating in "QA Short circuit", set and cleared through Circuit
 * Design → Edit panel → Equipment Specifications, as a user does (#314: the
 * form sends an emptied rating as null, so "Select AIC rating..." clears it).
 */

/** Selects `value` ('42', or '' for "Select AIC rating...") and saves; returns the PATCH body. */
export async function saveMdpAicThroughForm(page: Page, base: string, value: string) {
  await page.goto(base + '/circuits');
  const edit = page.locator('[title="Edit panel"]').first();
  await edit.waitFor({ state: 'attached', timeout: 20_000 });
  await edit.click({ force: true }); // the edit icon shows on hover
  await page.getByRole('button', { name: /Equipment Specifications \(Optional\)/ }).click();
  await page.locator('select').filter({ has: page.locator('option', { hasText: 'Select AIC rating...' }) }).selectOption(value);
  const saved = page.waitForResponse(r => r.url().includes('/rest/v1/panels') && r.request().method() === 'PATCH');
  await page.getByRole('button', { name: /Save Changes/ }).click();
  const response = await saved;
  expect(response.ok()).toBe(true);
  return response.request().postData() ?? '';
}

/** The MDP's stored `aic_rating`, or with `clear` sets it to null directly (QA session only). */
async function storedMdpAic(page: Page, project: string, clear = false) {
  return page.evaluate(async ({ project, clear }) => {
    // @ts-expect-error — served by the Vite dev server
    const { supabase } = await import('/lib/supabase.ts');
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email !== 'augustovalbuena+qa@gmail.com') throw new Error('not the QA account');
    const { data: proj } = await supabase.from('projects').select('id').eq('name', project).single();
    const q = supabase.from('panels');
    const { data, error } = clear
      ? await q.update({ aic_rating: null }).eq('project_id', proj.id).eq('name', 'MDP').select('aic_rating')
      : await q.select('aic_rating').eq('project_id', proj.id).eq('name', 'MDP');
    if (error) throw new Error(error.message);
    if (data.length !== 1) throw new Error(`expected one MDP, found ${data.length}`);
    return data[0].aic_rating as number | null;
  }, { project, clear });
}

/**
 * Restores the fixture's empty rating through the form. If the form left a
 * value (as main did before #314), clears it directly so the fixture survives
 * for the other specs, and fails.
 */
export async function restoreMdpAicEmpty(page: Page, base: string, project: string) {
  await saveMdpAicThroughForm(page, base, '');
  const left = await storedMdpAic(page, project);
  if (left !== null) {
    await storedMdpAic(page, project, true);
    throw new Error(`"Select AIC rating..." left aic_rating = ${left}; cleared it directly (#314)`);
  }
}
