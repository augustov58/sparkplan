import { test, expect } from '@playwright/test';

/**
 * #280 — the Copilot (check_conductor_sizing, run_quick_inspection), Circuit
 * Sharing and the multifamily generator size and check conductors by the #271
 * rule (owner ruling 2026-11-21): breaker ≥ 125 % of a continuous load; Table
 * 310.16 at 60 °C up to 100 A, 75 °C above; a check passes anything code-legal.
 * Expected values: the issue's Acceptance section (hand-calculated).
 *
 * Circuit Sharing runs in the UI ("QA EV builder"). The Copilot tools and the
 * generator run through the app's own modules in the page (the Copilot chat
 * depends on an external LLM). Read-only: nothing is saved.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

test('#280 Circuit Sharing: a 48 A charger needs a 60 A circuit with 4 AWG Cu', async ({ page }) => {
  await page.goto('/');
  const card = page.getByText('QA EV builder', { exact: true }).first();
  await expect(card, 'QA project "QA EV builder" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/tools'));
  const main = page.locator('main');
  await main.getByRole('button', { name: /Circuit Sharing/i }).first().click();
  await main.locator('label', { hasText: 'Charger Size' }).locator('xpath=..').locator('select').first().selectOption('48');
  const req = main.getByText('Circuit Requirements').locator('xpath=..');
  await expect(req).toContainText(/Circuit Size:\s*60A/);           // main: 48A
  await expect(req).toContainText(/Wire Size:\s*#4 AWG Cu/);        // main: #8 AWG Cu
  await expect(req).toContainText('#6 AWG Cu with 75 °C-listed terminations');
  await expect(req).toContainText(/Breaker:\s*60A 2-pole breaker/);
});

test('#280 Copilot conductor checks and the multifamily generator', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(async () => {
    // @ts-expect-error — served by the Vite dev server
    const { executeTool } = await import('/services/ai/chatTools.ts');
    // @ts-expect-error — served by the Vite dev server
    const { generateBasicMultiFamilyProject } = await import('/services/autogeneration/multiFamilyProjectGenerator.ts');
    const ctx = (circuits: unknown[]) => ({ projectId: 'x', projectContext: { panels: [{ name: 'P', voltage: 240, phase: 1, busRating: 400, totalLoadVA: 0 }], circuits } });
    const check = async (conductor_size: string, breaker_amps: number, load_amps: number, continuous = false) =>
      (await executeTool('check_conductor_sizing', { conductor_size, breaker_amps, load_amps, continuous }, ctx([]))).data;
    const inspect = async (conductorSize: string, breakerAmps: number) =>
      (await executeTool('run_quick_inspection', { category: 'circuits' },
        ctx([{ circuitNumber: 1, description: 'Feeder test', panelName: 'P', breakerAmps, conductorSize, loadWatts: 2400 }])))
        .data.issues.filter((i: { description: string }) => /conductor/.test(i.description)).map((i: { severity: string }) => i.severity);
    const heat = (kw: number) => {
      const g = generateBasicMultiFamilyProject({ projectId: 'x', voltage: 240, phase: 1, dwellingUnits: 2, avgUnitSqFt: 1000, serviceAmps: 400, commonAreaLoadVA: 5000, hasElectricCooking: true, hasElectricHeat: true, applianceConfig: { heatingKW: kw } });
      const unit = Array.from(g.unitCircuits.values())[0] as { description: string; breaker_amps: number; conductor_size: string }[];
      return Object.fromEntries(unit.map(c => [c.description, `${c.breaker_amps} ${c.conductor_size}`]));
    };
    const s2 = await check('8 AWG', 60, 48, true);
    return {
      s2: [s2.compliant, s2.minimumRequiredSize],
      s3: (await check('6 AWG', 60, 44)).compliant,
      s4: [await inspect('8 AWG', 50), await inspect('6 AWG', 70), await inspect('8 AWG', 60)],
      s5: await inspect('1 AWG', 150),
      s7: [heat(19.2)['Electric Heat / Heat Pump'], heat(28.8)['Electric Heat / Heat Pump'], heat(19.2)['Range/Oven'], heat(19.2)['Water Heater']],
    };
  });
  expect(r.s2).toEqual([false, '4 AWG']);                                  // 2 — main: compliant
  expect(r.s3).toBe(true);                                                 // 3 — 240.4(B)
  expect(r.s4).toEqual([['warning'], ['warning'], ['critical']]);          // 4 — main: [], ['critical'], ['critical']
  expect(r.s5).toEqual([]);                                                // 5 — main: ['critical']
  expect(r.s7).toEqual(['100 1 AWG Cu', '150 1/0 AWG Cu', '45 6 AWG Cu', '25 10 AWG Cu']); // 7 — main: 2 AWG / 2/0
});
