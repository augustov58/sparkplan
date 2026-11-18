import { test, expect, Page } from '@playwright/test';

/**
 * #230 — the EV Panel Builder's preview reads the panel Create makes: its NEC
 * 220 demand, its 408.30 bus design load and circuit count (no setpoint
 * marker), not a breaker sum. The lighting circuit is 1-pole, coded 'L'; the
 * setpoint marker sits after the real circuits; labels toggle their boxes.
 * Expected values: the hand calculation in the issue's Acceptance section.
 * QA project: tests/e2e/fixtures.md. Writes: creates two panels and deletes
 * them in `finally`, through the app's own client as the QA user.
 */

const PROJECT_NAME = 'QA EV builder';
const FIXTURE_PANELS = ['MDP', 'EV Panel', 'Office Panel'];

async function client(page: Page) {
  return page.evaluate(async ({ projectName, keep }) => {
    const clientModule = '/lib/supabase.ts';
    const { supabase } = await import(/* @vite-ignore */ clientModule);
    const { data: proj } = await supabase.from('projects').select('id').eq('name', projectName).single();
    const { data: panels } = await supabase.from('panels').select('id,name').eq('project_id', proj!.id);
    const created = (panels ?? []).filter((x: { name: string }) => !keep.includes(x.name));
    const out: Record<string, { description: string; circuit_number: number; pole: number; load_type: string }[]> = {};
    for (const p of created) {
      const { data } = await supabase.from('circuits').select('description,circuit_number,pole,load_type').eq('panel_id', p.id);
      out[p.name] = data ?? [];
    }
    return out;
  }, { projectName: PROJECT_NAME, keep: FIXTURE_PANELS });
}

async function removeCreatedPanels(page: Page) {
  await page.evaluate(async ({ projectName, keep }) => {
    const clientModule = '/lib/supabase.ts';
    const { supabase } = await import(/* @vite-ignore */ clientModule);
    const { data: proj } = await supabase.from('projects').select('id').eq('name', projectName).single();
    const { data: panels } = await supabase.from('panels').select('id,name').eq('project_id', proj!.id);
    for (const p of (panels ?? []).filter((x: { name: string }) => !keep.includes(x.name))) {
      await supabase.from('circuits').delete().eq('panel_id', p.id);
      await supabase.from('panels').delete().eq('id', p.id);
    }
  }, { projectName: PROJECT_NAME, keep: FIXTURE_PANELS });
}

test('#230 the EV Panel Builder previews the panel it creates', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  await removeCreatedPanels(page);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
  const main = page.locator('main');

  const openBuilder = async () => {
    await page.goto(`${projectUrl}/tools`);
    await page.getByRole('button', { name: 'EV Panel Builder' }).click();
    await expect(page.getByRole('button', { name: 'Create EV Panel' })).toBeEnabled({ timeout: 15_000 });
  };
  const create = async (circuits: number) => {
    const saved: number[] = [];
    page.on('response', r => {
      if (r.url().includes('/rest/v1/circuits') && r.request().method() === 'POST') saved.push(r.status());
    });
    await page.getByRole('button', { name: 'Create EV Panel' }).click();
    await expect.poll(() => saved.length, { timeout: 20_000 }).toBe(circuits);
  };

  try {
    await openBuilder();
    // 1 — default: 4 × 48 A, spare, lighting (was "Total Load 280A", 46.0 kW, 93%)
    await expect(main).toContainText(/Demand Load \(NEC 220\):\s*199\.5 A \(47\.9 kVA\)/);
    await expect(main).toContainText(/Bus Design Load \(NEC 408\.30\):\s*247\.5 A/);
    await expect(main).toContainText(/Panel Rating:\s*300A/);
    await expect(main).toContainText(/Panel Utilization \(bus design load ÷ rating\)\s*83%/);
    await expect(main).toContainText(/Total Circuits:\s*6/);

    // 5 — label text toggles its checkbox
    const lighting = page.locator('#ev-builder-lighting');
    await expect(lighting).toBeChecked();
    await page.locator('label[for="ev-builder-lighting"]').click();
    await expect(lighting).not.toBeChecked();
    await page.locator('label[for="ev-builder-lighting"]').click();
    await expect(lighting).toBeChecked();

    // 3 — create: success toast, lighting 1-pole 'L'
    await create(6);
    await expect(page.getByText('EV panel "4× Level 2 (48A) Panel" created under the MDP with 6 circuits')).toBeVisible({ timeout: 10_000 });
    let rows = await client(page);
    const plain = rows['4× Level 2 (48A) Panel'] ?? [];
    expect(plain).toHaveLength(6);
    expect(plain.find(c => c.description === 'Lighting Circuit')).toMatchObject({ pole: 1, load_type: 'L' }); // was 2-pole 'O'

    // 2 — EVEMS, 3 simultaneous (default): setpoint 34,560 VA (was "Total Circuits 7")
    await openBuilder();
    await page.locator('label[for="ev-builder-evems"]').click();
    await expect(page.locator('#ev-builder-evems')).toBeChecked();
    await expect(main).toContainText(/Demand Load \(NEC 220, EVEMS setpoint\):\s*151\.5 A \(36\.4 kVA\)/);
    await expect(main).toContainText(/Bus Design Load \(NEC 408\.30\):\s*187\.5 A/);
    await expect(main).toContainText(/Panel Rating:\s*225A/);
    await expect(main).toContainText(/Total Circuits:\s*6/);

    // 7 — fewer chargers than the simultaneous setting: clamped (the stale 3
    // gave a 225 A bus and a 34,560 VA setpoint for one 11,520 VA charger)
    const chargers = main.locator('input[type=number]').first();
    await chargers.fill('1');
    await expect(main).toContainText(/Panel Rating:\s*100A/);
    await expect(main).toContainText(/Demand Load \(NEC 220, EVEMS setpoint\):\s*55\.5 A \(13\.3 kVA\)/);
    await expect(main).toContainText(/Bus Design Load \(NEC 408\.30\):\s*67\.5 A/);
    await expect(main).toContainText('Manages 1 simultaneous charger');
    await chargers.fill('4');
    await expect(main).toContainText(/Panel Rating:\s*225A/);

    // 4 — the marker after the real circuits: spare 10, lighting 14, marker 16
    await create(7);
    rows = await client(page);
    const managed = rows['4× Level 2 (48A) with EVEMS Panel'] ?? [];
    const slot = (d: string) => managed.find(c => c.description === d)?.circuit_number;
    expect([slot('Spare Circuit'), slot('Lighting Circuit'), slot('EVEMS Aggregate Setpoint (NEC 625.42)')]).toEqual([10, 14, 16]); // marker was 10
  } finally {
    await removeCreatedPanels(page);
  }
});
