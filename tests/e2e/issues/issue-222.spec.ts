import { test, expect, Page } from '@playwright/test';

/**
 * #222 — a panel with EV chargers and no EVEMS setpoint gets an "Add EVEMS
 * setpoint" control (it used to take "Add Circuit" with the exact marker
 * description). Expected: the issue's Acceptance section. QA project: "QA
 * EVEMS marker edit". Writes: removes and re-adds the marker, then restores
 * the fixture's marker (slot 15, 28,800 VA) in `finally`.
 */

const PROJECT_NAME = 'QA EVEMS marker edit';
const MARKER = 'EVEMS Aggregate Setpoint (NEC 625.42)';

async function resetMarker(page: Page) {
  const result = await page.evaluate(async ({ projectName, marker }) => {
    const clientModule = '/lib/supabase.ts';
    const { supabase } = await import(/* @vite-ignore */ clientModule);
    const { data: proj } = await supabase.from('projects').select('id').eq('name', projectName).single();
    const { data: ev } = await supabase.from('panels').select('id').eq('project_id', proj!.id).eq('name', 'EV Panel').single();
    await supabase.from('circuits').delete().eq('panel_id', ev!.id).eq('description', marker);
    const { data: rec } = await supabase.from('circuits').select('*').eq('panel_id', ev!.id).eq('description', 'Receptacles').single();
    const { id: _id, created_at: _c, updated_at: _u, ...row } = rec as Record<string, unknown>;
    const { error } = await supabase.from('circuits').insert({ ...row, circuit_number: 15, description: marker, load_type: 'O', load_watts: 28_800 });
    return error ? error.message : 'ok';
  }, { projectName: PROJECT_NAME, marker: MARKER });
  expect(result, 'reset the QA setpoint marker').toBe('ok');
}

test('#222 add an EVEMS setpoint to a panel with chargers', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await resetMarker(page);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/panel');
  const main = page.locator('main');
  const summary = page.locator('h4', { hasText: 'PANEL SUMMARY' }).locator('..');
  await expect(summary).toBeVisible({ timeout: 20_000 });
  const setpointCard = page.locator('h4', { hasText: 'EVEMS AGGREGATE SETPOINT' }).locator('xpath=ancestor::div[contains(@class,"bg-amber-50")][1]');

  try {
    // Guardrail: no Add control on a panel without chargers
    await main.getByText(/^Office Panel\(/).first().click();
    await expect(main.getByRole('button', { name: 'Add EVEMS setpoint' })).toHaveCount(0);

    // 1 — remove: the panel's chargers count at full load, and Add appears
    await main.getByText(/^EV Panel\(/).first().click();
    await expect(setpointCard).toContainText(/28\.8 kVA/, { timeout: 15_000 });
    page.once('dialog', d => d.accept());
    await setpointCard.getByRole('button', { name: 'Remove' }).click();
    await expect(summary).toContainText(/DIRECT DEMAND LOAD\s*36\.4 KVA/i, { timeout: 15_000 });
    await expect(main).toContainText('No EVEMS on this panel: its chargers count at full load (34.6 kVA)');

    // 2 — a setpoint at or above the chargers' load is flagged
    await main.getByRole('button', { name: 'Add EVEMS setpoint' }).click(); // was: no such control
    await main.getByLabel('EVEMS setpoint (VA)').fill('40000');
    await expect(main).toContainText("At or above the chargers' load (34.6 kVA): this setpoint limits nothing.");

    // 3 — 28,800 VA: the card and the clamp are back
    await main.getByLabel('EVEMS setpoint (VA)').fill('28800');
    const created = page.waitForResponse(r => r.url().includes('/rest/v1/circuits') && r.request().method() === 'POST', { timeout: 15_000 });
    await main.getByRole('button', { name: 'Save' }).click();
    await created;
    await expect(setpointCard).toContainText(/28\.8 kVA/, { timeout: 15_000 });
    await expect(setpointCard).toContainText(/120\.0 A/);
    await expect(summary).toContainText(/DIRECT DEMAND LOAD\s*\(NEC 625\.42 EVEMS\)\s*30\.6 KVA/i); // 28,800 + 1,800
    await expect(main.getByText(/^EV Panel\(4\)$/)).toBeVisible();
  } finally {
    await resetMarker(page);
  }
});
