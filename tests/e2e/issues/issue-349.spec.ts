import { test, expect, type Page } from '@playwright/test';
import { mainTextWhen } from './pageText';

/**
 * #349 (owner ruling 2026-11-25, option a): the Copilot's panel capacity tool
 * compared connected load with 80 % of the bus. It now compares the panel's
 * design load (#225) plus the proposed load with the bus rating (NEC 408.30);
 * a proposed EV charger, sign or show window takes 125 %.
 *
 * "QA Commercial panel" (MDP 200 A, 208 V 3Φ, 21,300 VA, no continuous loads):
 * hand calc 21,300 ÷ (208 × √3) = 59.1 A = 29.6 %.
 *
 * Gemini is stubbed to call the tool with the issue's loads; the tool itself
 * runs on the project's real data, and each test asserts what it returns to
 * the model (the continuation request). Nothing is written.
 */

const PROJECT = 'QA Commercial panel';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };

async function toolResult(page: Page, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  let result: Record<string, unknown> | undefined;
  await page.route('**/functions/v1/gemini-proxy', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS });
    const body = route.request().postDataJSON();
    if (body.toolResult) {
      result = body.toolResult.result;
      return route.fulfill({ headers: CORS, json: { response: 'Stubbed answer for #349.' } });
    }
    const call = { name, args };
    return route.fulfill({ headers: CORS, json: { functionCall: call, modelPart: { functionCall: call, thoughtSignature: 'sig-349' } } });
  });

  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText(PROJECT, { exact: true }).first();
  await expect(card, `QA project "${PROJECT}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/panel'));
  await mainTextWhen(page, ['Unit heater 1']); // the circuits (and so the design load) have loaded

  await page.getByRole('button', { name: 'Open Spark Copilot' }).click();
  await page.getByPlaceholder('Type your question… (Shift+Enter for newline)').fill('Can panel MDP take more load?');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Stubbed answer for #349.')).toBeVisible({ timeout: 30_000 });
  expect(result, 'the tool result sent back to the model').toBeDefined();
  return result!;
}

test('#349 1 a 30 A 3-phase load: 59.1 A → 89.1 A of 200 A, fits, no 80 % figure', async ({ page }) => {
  const r = await toolResult(page, 'check_panel_capacity', { panel_name: 'MDP', additional_load_watts: 10_808 });
  expect(r).toMatchObject({
    designLoadAmps: 59.1, utilizationPercent: 29.6, additionalLoadContinuous: false,
    projectedLoadAmps: 89.1, projectedUtilizationPercent: 44.6, canAccommodate: true,
  }); // main: currentUtilization 37 of maxContinuousLoadVA 57,641 ("80% rule")
  expect(JSON.stringify(r)).not.toMatch(/80 ?%|maxContinuous/);
});

test('#349 2 the same load as an EV charger takes 125 %: 96.6 A, 48.3 %', async ({ page }) => {
  const r = await toolResult(page, 'check_panel_capacity', { panel_name: 'MDP', additional_load_watts: 10_808, additional_load_description: 'EV charger' });
  expect(r).toMatchObject({ additionalLoadContinuous: true, additionalLoadAmps: 37.5, projectedLoadAmps: 96.6, projectedUtilizationPercent: 48.3, canAccommodate: true });
});

test('#349 3 a 150 A 3-phase load: 209.1 A on a 200 A bus does not fit', async ({ page }) => {
  const r = await toolResult(page, 'check_panel_capacity', { panel_name: 'MDP', additional_load_watts: 54_040 });
  expect(r).toMatchObject({ projectedLoadAmps: 209.1, canAccommodate: false });
});

test('#349 4 the project summary gives MDP 29.6 % (main: 37 %)', async ({ page }) => {
  const r = await toolResult(page, 'get_project_summary', {});
  const panels = r.panels as Array<{ name: string; utilization: number | null }>;
  expect(panels.find(p => p.name === 'MDP')?.utilization).toBe(29.6);
});
