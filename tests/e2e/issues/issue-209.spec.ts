import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #209 — the EVEMS setpoint card can edit and remove the setpoint (its marker
 * circuit is hidden as metadata everywhere else), and the panel's circuit
 * count leaves the marker out. Expected values: the hand calculation in the
 * issue's Acceptance section. QA project: tests/e2e/fixtures.md.
 *
 * Writes: edits and removes the setpoint in the QA project. The fixture
 * (one marker at 28,800 VA on EV Panel) is reset before and after the run,
 * through the app's own client as the QA user. F-EV is never recalculated,
 * so its stored design load stays 37.8 kVA.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-209';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = 'QA EVEMS marker edit';
const MARKER = 'EVEMS Aggregate Setpoint (NEC 625.42)';

/** Exactly one setpoint marker at 28,800 VA on EV Panel */
async function resetMarker(page: Page) {
  const result = await page.evaluate(async ({ projectName, marker }) => {
    // The app's own client, in the browser (a path only Vite resolves)
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

test('#209 the EVEMS setpoint can be edited and removed', async ({ page }) => {
  test.setTimeout(120_000);

  // The welcome modal opens while the project list is still loading
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await resetMarker(page);
  await page.reload();
  await page.waitForLoadState('networkidle');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');

  const main = page.locator('main');
  const summary = page.locator('h4', { hasText: 'PANEL SUMMARY' }).locator('..');
  const setpointCard = page.locator('h4', { hasText: 'EVEMS AGGREGATE SETPOINT' })
    .locator('xpath=ancestor::div[contains(@class,"bg-amber-50")][1]');
  const feederCard = (name: string) =>
    page.locator('h4', { hasText: new RegExp(`^${name}$`) }).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
  const openEvPanel = async () => {
    await page.goto(`${projectUrl}/panel`);
    await expect(summary).toBeVisible({ timeout: 20_000 });
    await main.getByText(/^EV Panel\(/).first().click();
  };

  try {
    // 1 — the card has Edit / Remove; the tab counts real circuits only
    await openEvPanel();
    await expect(main.getByText(/^EV Panel\(4\)$/)).toBeVisible(); // was (5), the marker included
    await expect(setpointCard).toContainText(/28\.8 kVA/);
    await expect(setpointCard).toContainText(/120\.0 A/);
    await expect(summary).toContainText(/30\.6 KVA/i); // 28,800 + 1,800

    // 2 — edit the setpoint to 23,040 VA
    await setpointCard.getByRole('button', { name: 'Edit' }).click();
    await setpointCard.getByLabel('EVEMS setpoint (VA)').fill('23040');
    const patched = page.waitForResponse(r => r.url().includes('/rest/v1/circuits') && r.request().method() === 'PATCH', { timeout: 15_000 });
    await setpointCard.getByRole('button', { name: 'Save' }).click();
    await patched;
    await expect(setpointCard).toContainText(/23\.0 kVA/);
    await expect(setpointCard).toContainText(/96\.0 A/);
    await expect(summary).toContainText(/DIRECT DEMAND LOAD\s*\(NEC 625\.42 EVEMS\)\s*24\.8 KVA/i); // 23,040 + 1,800
    await expect(summary).toContainText(/DEMAND AMPS\s*103\.5 A/i);
    await shot(page, '2-edited');

    // 3 — F-EV flags the new design load: 24,840 + 25% × 23,040 = 30,600
    await page.goto(`${projectUrl}/feeders`);
    await expect(feederCard('F-EV')).toContainText(/Design load:\s*37\.8 → 30\.6 kVA/, { timeout: 20_000 });
    await expect(feederCard('F-Office')).not.toContainText('Outdated');

    // 4 — remove the setpoint
    await openEvPanel();
    page.once('dialog', dialog => dialog.accept());
    const deleted = page.waitForResponse(r => r.url().includes('/rest/v1/circuits') && r.request().method() === 'DELETE', { timeout: 15_000 });
    await setpointCard.getByRole('button', { name: 'Remove' }).click();
    await deleted;
    await expect(page.locator('h4', { hasText: 'EVEMS AGGREGATE SETPOINT' })).toHaveCount(0);
    await expect(summary).toContainText(/DIRECT DEMAND LOAD\s*36\.4 KVA/i); // 34,560 + 1,800, no EVEMS tag
    await expect(summary).toContainText(/DEMAND AMPS\s*151\.5 A/i);
    await expect(main.getByText(/EV Charger #\d/)).toHaveCount(3);
    await shot(page, '4-removed');

    // 5 — F-EV back to the full load: 36,360 + 25% × 34,560 = 45,000
    await page.goto(`${projectUrl}/feeders`);
    await expect(feederCard('F-EV')).toContainText(/Design load:\s*37\.8 → 45\.0 kVA/, { timeout: 20_000 });
  } finally {
    await resetMarker(page);
  }
});
