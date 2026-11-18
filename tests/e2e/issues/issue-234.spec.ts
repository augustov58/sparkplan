import { test, expect, Page } from '@playwright/test';

/**
 * #234 — a refetch that started before a delete must not bring the deleted
 * row back. Circuit list fetches are delayed 3 s and a refetch is started
 * just before "Remove" deletes the EVEMS setpoint marker: on `main` it lands
 * after the delete and the card comes back (until another refetch, which
 * without a realtime event never comes). Expected: the issue's Acceptance section. QA project:
 * tests/e2e/fixtures.md ("QA EVEMS marker edit"). Writes: removes the marker,
 * then restores it in `finally`.
 */

const PROJECT_NAME = 'QA EVEMS marker edit';
const MARKER = 'EVEMS Aggregate Setpoint (NEC 625.42)';

/** Exactly one setpoint marker at 28,800 VA on EV Panel (as issue-209.spec.ts) */
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

test('#234 a removed setpoint stays removed while an older refetch lands', async ({ page }) => {
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
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
  const main = page.locator('main');
  const heading = page.locator('h4', { hasText: 'EVEMS AGGREGATE SETPOINT' });
  const setpointCard = heading.locator('xpath=ancestor::div[contains(@class,"bg-amber-50")][1]');

  try {
    await page.goto(`${projectUrl}/panel`);
    await expect(page.locator('h4', { hasText: 'PANEL SUMMARY' })).toBeVisible({ timeout: 20_000 });
    await main.getByText(/^EV Panel\(/).first().click();
    await expect(setpointCard).toContainText(/28\.8 kVA/, { timeout: 15_000 });

    // Every circuit list fetch from here on is answered 3 s late: the request
    // reaches the database at once (so it reads the rows as they are now),
    // only its response is held back
    await page.route('**/rest/v1/circuits?**', async route => {
      if (route.request().method() !== 'GET') return route.continue();
      const response = await route.fetch();
      await new Promise(r => setTimeout(r, 3_000));
      await route.fulfill({ response });
    });

    // A refetch of the old rows starts (the event realtime and the Copilot's
    // tools send; it doesn't depend on the realtime socket) and takes 3 s…
    await page.evaluate(async () => {
      const eventsModule = '/lib/dataRefreshEvents.ts';
      const { dataRefreshEvents } = await import(/* @vite-ignore */ eventsModule);
      dataRefreshEvents.emit('circuits');
    });
    await page.waitForTimeout(300);

    // …which is still in flight when Remove deletes the marker
    page.once('dialog', dialog => dialog.accept());
    const deleted = page.waitForResponse(r => r.url().includes('/rest/v1/circuits') && r.request().method() === 'DELETE', { timeout: 15_000 });
    await setpointCard.getByRole('button', { name: 'Remove' }).click();
    await deleted;

    // The card must not come back while the older fetches land (was: it did)
    let maxSeen = 0;
    for (let t = 0; t < 60; t++) {
      maxSeen = Math.max(maxSeen, await heading.count());
      await page.waitForTimeout(100);
    }
    expect(maxSeen, 'the removed setpoint card reappeared').toBe(0);
    await expect(main.getByText(/^EV Panel\(4\)$/)).toBeVisible();
  } finally {
    await page.unroute('**/rest/v1/circuits?**');
    await resetMarker(page);
  }
});
