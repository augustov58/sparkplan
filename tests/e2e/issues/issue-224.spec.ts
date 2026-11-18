import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #224 — EV Panel Builder "Create EV Panel" saves the panel under the MDP with
 * all its circuits (every circuit insert used to fail, leaving an empty
 * service-fed panel), and with EVEMS an explicit setpoint marker. Expected
 * values: the hand calculation in the issue's Acceptance section. QA project:
 * tests/e2e/fixtures.md. Writes: creates two panels and deletes them in
 * `finally`, through the app's own client as the QA user.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-224';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = 'QA EV builder';

/** Delete every panel but the fixture's three (MDP, EV Panel, Office Panel) */
async function removeCreatedPanels(page: Page) {
  await page.evaluate(async (projectName) => {
    const clientModule = '/lib/supabase.ts';
    const { supabase } = await import(/* @vite-ignore */ clientModule);
    const { data: proj } = await supabase.from('projects').select('id').eq('name', projectName).single();
    const { data: panels } = await supabase.from('panels').select('id,name').eq('project_id', proj!.id);
    for (const p of (panels ?? []).filter((x: { name: string }) => !['MDP', 'EV Panel', 'Office Panel'].includes(x.name))) {
      await supabase.from('circuits').delete().eq('panel_id', p.id);
      await supabase.from('panels').delete().eq('id', p.id);
    }
  }, PROJECT_NAME);
}

test('#224 Create EV Panel saves the panel under the MDP with its circuits', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded'); // not networkidle: realtime keeps the dashboard busy; the next step waits for what it needs
  await removeCreatedPanels(page);
  await page.reload();
  await page.waitForLoadState('domcontentloaded'); // not networkidle: realtime keeps the dashboard busy; the next step waits for what it needs
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
  const main = page.locator('main');
  const summary = page.locator('h4', { hasText: 'PANEL SUMMARY' }).locator('..');

  const create = async (evems: boolean) => {
    await page.goto(`${projectUrl}/tools`);
    await page.getByRole('button', { name: 'EV Panel Builder' }).click();
    if (evems) {
      // The labels aren't tied to their inputs: the EVEMS box is the first
      // checkbox, "Max Simultaneous Chargers" the second number field
      await main.locator('input[type=checkbox]').first().check();
      await main.locator('input[type=number]').nth(1).fill('2');
    }
    const circuitsSaved: number[] = [];
    page.on('response', r => {
      if (r.url().includes('/rest/v1/circuits') && r.request().method() === 'POST') circuitsSaved.push(r.status());
    });
    // Enabled once the project's panels are loaded (the panel attaches to the MDP)
    await expect(page.getByRole('button', { name: 'Create EV Panel' })).toBeEnabled({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Create EV Panel' }).click();
    await expect.poll(() => circuitsSaved.length, { timeout: 20_000 }).toBe(evems ? 7 : 6);
    expect(circuitsSaved.every(s => s === 201)).toBe(true); // was 6 × 400
  };

  try {
    // 1–3 — defaults: 4 × 48 A, spare, lighting
    await create(false);
    await page.goto(`${projectUrl}/panel`);
    await expect(summary).toBeVisible({ timeout: 20_000 });
    await expect(main.getByText(/^4× Level 2 \(48A\) Panel\(6\)$/)).toBeVisible(); // was (0)
    await expect(summary).toContainText(/DEMAND WITH FEEDERS\s*97\.7 KVA/i); // 49,860 + 47,880, under the MDP
    await main.getByText(/^4× Level 2 \(48A\) Panel\(/).first().click();
    await expect(summary).toContainText(/DIRECT DEMAND LOAD\s*47\.9 KVA/i); // 4 × 11,520 + 1,800
    await expect(summary).toContainText(/DEMAND AMPS\s*199\.5 A/i);
    await shot(page, '1-created');

    // 4 — with EVEMS, 2 simultaneous: explicit setpoint 2 × 11,520
    await create(true);
    await page.goto(`${projectUrl}/panel`);
    await expect(summary).toBeVisible({ timeout: 20_000 });
    await main.getByText(/^4× Level 2 \(48A\) with EVEMS Panel\(6\)$/).click();
    const setpoint = page.locator('h4', { hasText: 'EVEMS AGGREGATE SETPOINT' }).locator('xpath=ancestor::div[contains(@class,"bg-amber-50")][1]');
    await expect(setpoint).toContainText(/23\.0 kVA/);
    await expect(setpoint).toContainText(/96\.0 A/);
    await expect(summary).toContainText(/24\.8 KVA/i); // 23,040 + 1,800
    await shot(page, '2-evems');
  } finally {
    await removeCreatedPanels(page);
  }
});
