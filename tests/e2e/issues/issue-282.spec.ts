import { test, expect, type Page } from '@playwright/test';

/**
 * #282 — whole dwellings count each small-appliance and laundry circuit at the
 * larger of its VA or 1,500 VA (220.52(A)/(B); owner ruling 2026-11-21, 4b);
 * the single-family subpanel keeps #284's handling (4a). Expected values: the
 * issue's Acceptance section (hand-calculated).
 *
 * QA projects (tests/e2e/fixtures.md): "QA Dwelling generate" (Main Panel),
 * "QA MF feeders" (Unit 101 Panel), "QA SF subpanel 217". The spec raises three
 * circuits through the app's Supabase client in the QA session and always puts
 * them back to 1,500 VA.
 */

const EDITS = [
  { project: 'QA Dwelling generate', description: 'Kitchen Small Appliance 1', va: 2400 },
  { project: 'QA Dwelling generate', description: 'Laundry', va: 2000 },
  { project: 'QA MF feeders', panel: 'Unit 101 Panel', description: 'Kitchen Small Appliance #1', va: 2400 },
];

async function setCircuitVA(page: Page, edit: (typeof EDITS)[number], va: number) {
  const n = await page.evaluate(async ({ edit, va }) => {
    // @ts-expect-error — served by the Vite dev server
    const { supabase } = await import('/lib/supabase.ts');
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email !== 'augustovalbuena+qa@gmail.com') throw new Error('not the QA account');
    const { data: proj } = await supabase.from('projects').select('id').eq('name', edit.project).single();
    let q = supabase.from('circuits').update({ load_watts: va }).eq('project_id', proj.id).eq('description', edit.description);
    if (edit.panel) {
      const { data: panel } = await supabase.from('panels').select('id').eq('project_id', proj.id).eq('name', edit.panel).single();
      q = q.eq('panel_id', panel.id);
    }
    const { data, error } = await q.select('id');
    if (error) throw new Error(error.message);
    return data.length;
  }, { edit, va });
  expect(n, `${edit.project} → ${edit.description}`).toBe(1);
}

async function panelSummary(page: Page, project: string, panel: string) {
  await page.goto('/');
  await page.reload();
  const card = page.getByText(project, { exact: true }).first();
  await expect(card, `QA project "${project}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/panel');
  const main = page.locator('main');
  await main.getByText(panel).first().click();
  const summary = page.locator('h4', { hasText: 'PANEL SUMMARY' }).locator('..');
  await expect(summary).toBeVisible({ timeout: 20_000 });
  return { main, summary, general: main.locator('tr', { hasText: 'General lighting + small appliance + laundry' }).first() };
}

test('#282 whole dwellings take small-appliance and laundry circuits at the larger of their VA or 1,500 VA', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  try {
    // A1 / B1: generated circuits, unchanged
    let p = await panelSummary(page, 'QA Dwelling generate', 'Main Panel');
    await expect(p.general).toContainText(/11\.70\s+0\.52\s+6\.04/);
    await expect(p.summary).toContainText(/DWELLING DEMAND[\s\S]*29\.6 KVA[\s\S]*123\.2 A/i);
    p = await panelSummary(page, 'QA MF feeders', 'Unit 101 Panel');
    await expect(p.general).toContainText(/7\.50\s+0\.61\s+4\.58/);
    await expect(p.summary).toContainText(/DIRECT DEMAND LOAD[\s\S]*29\.7 KVA[\s\S]*123\.8 A/i);

    for (const e of EDITS) await setCircuitVA(page, e, e.va);

    // A2: new house on Part III — 13,100 / 6,535 VA; 30,060 VA (main: 11.70 / 6.04; 29.6)
    p = await panelSummary(page, 'QA Dwelling generate', 'Main Panel');
    await expect(p.general).toContainText(/13\.10\s+0\.50\s+6\.54/);
    await expect(p.summary).toContainText(/DWELLING DEMAND[\s\S]*30\.1 KVA[\s\S]*125\.3 A/i);
    // B2: unit panel — 8,400 / 4,890 VA; 30,015 VA (main: 7.50 / 4.58; 29.7)
    p = await panelSummary(page, 'QA MF feeders', 'Unit 101 Panel');
    await expect(p.general).toContainText(/8\.40\s+0\.58\s+4\.89/);
    await expect(p.summary).toContainText(/DIRECT DEMAND LOAD[\s\S]*30\.0 KVA[\s\S]*125\.1 A/i);
    // B3: the MDP's feed-thru row is the unit's number (#179)
    await p.main.getByText('MDP').first().click();
    await expect(p.main.locator('tr', { hasText: 'Unit 101 Panel' }).first()).toContainText(/30\.0/, { timeout: 20_000 });

    // C (4a): the single-family subpanel is unchanged
    p = await panelSummary(page, 'QA SF subpanel 217', 'Pool Subpanel');
    await expect(p.summary).toContainText(/DIRECT DEMAND LOAD\s*5\.4 KVA/i);
    await expect(p.summary).toContainText(/DEMAND AMPS\s*22\.3 A/i);
  } finally {
    for (const e of EDITS) await setCircuitVA(page, e, 1500);
  }
});
