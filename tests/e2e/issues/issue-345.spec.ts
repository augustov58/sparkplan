import { test, expect, type Page } from '@playwright/test';

/**
 * #345: the Copilot's analyze_change_impact tool passed Gemini's improvised
 * load fields (`load_type`) to the backend, which answered 422.
 *
 * 1  given the 2026-11-25 call ({quantity: 2, load_type: 'ev_charger',
 *    amps: 40}), the backend receives {type, amps, quantity} and the Copilot
 *    answers. The proxy and the backend are stubbed: nothing reaches Gemini
 *    and nothing is written.
 */

const PROJECT = 'QA Commercial calc';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
const QUESTION = 'Analyze the change impact of adding 2 Level 2 EV chargers at 40 A each to this project';

async function openProject(page: Page, name: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText(name, { exact: true }).first();
  await expect(card, `QA project "${name}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
}

test('#345 1 the change-impact tool sends the backend {type, amps, quantity}', async ({ page }) => {
  const call = {
    name: 'analyze_change_impact',
    args: { change_description: 'Adding 2 Level 2 EV chargers at 40A each', loads: [{ quantity: 2, load_type: 'ev_charger', amps: 40 }] },
  };
  await page.route('**/functions/v1/gemini-proxy', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS });
    const body = route.request().postDataJSON();
    return route.fulfill({
      headers: CORS,
      json: body.toolResult
        ? { response: 'Stubbed impact answer for #345.' }
        : { functionCall: call, modelPart: { functionCall: call, thoughtSignature: 'sig-345' } },
    });
  });
  let backendBody: { proposed_loads?: unknown } | undefined;
  await page.route('**/api/agent-actions/analyze-change', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS });
    backendBody = route.request().postDataJSON();
    return route.fulfill({
      headers: CORS,
      json: { title: 'Impact', description: 'd', reasoning: 'r', impact_analysis: {}, confidence_score: 0.9 },
    });
  });

  await openProject(page, PROJECT);
  await page.getByRole('button', { name: 'Open Spark Copilot' }).click();
  await page.getByPlaceholder('Type your question… (Shift+Enter for newline)').fill(QUESTION);
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('Stubbed impact answer for #345.')).toBeVisible({ timeout: 30_000 });
  expect(backendBody?.proposed_loads).toEqual([{ type: 'ev_charger', amps: 40, quantity: 2 }]); // main: load_type → 422
});
