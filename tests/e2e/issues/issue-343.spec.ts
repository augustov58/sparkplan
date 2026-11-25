import { test, expect, type Page } from '@playwright/test';
import { loadEnv } from 'vite';
import { PDFDocument, StandardFonts } from 'pdf-lib';

/**
 * #343: on Gemini 3 (where gemini-2.5-flash reroutes on 2026-12-01) the
 * Copilot's tool answers failed: the proxy sent the tool result as role
 * 'function' (a 400) after a bare call with no thought signature. RFI PDF
 * extraction asked for gemini-2.0-flash-exp (shut down: 400 "not found").
 *
 * 1  the Copilot sends the model's call part back with the tool result, and
 *    names no model (stubbed proxy: nothing reaches Gemini)
 * 2  the deployed proxy completes a tool round trip on gemini-3.8-flash and
 *    ignores a caller's model (live, two small calls; fails until deployed)
 * 3  RFIs → Extract from PDF fills the subject from a generated PDF (live)
 * 6  an answer written in LaTeX shows as plain text (stubbed)
 *
 * E2E_PROXY_FUNCTION=<name> runs 2–3 against another deployed copy of the
 * function (a pre-merge test deploy); the app's calls are routed to it.
 */

const { VITE_SUPABASE_URL: SUPABASE_URL } = loadEnv('development', process.cwd(), 'VITE_SUPABASE_');
const PROJECT = 'QA Commercial calc';
const PROXY = '**/functions/v1/gemini-proxy';
const PROXY_FUNCTION = process.env.E2E_PROXY_FUNCTION || 'gemini-proxy';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };

async function openProject(page: Page, name: string): Promise<string> {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText(name, { exact: true }).first();
  await expect(card, `QA project "${name}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

test('#343 1 the Copilot sends the model\'s call part back with the tool result', async ({ page }) => {
  const callPart = { functionCall: { name: 'get_project_summary', args: {}, id: 'call-343' }, thoughtSignature: 'sig-343' };
  const bodies: Record<string, unknown>[] = [];
  await page.route(PROXY, async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS });
    const body = route.request().postDataJSON();
    bodies.push(body);
    return route.fulfill({
      headers: CORS,
      json: body.toolResult
        ? { response: 'Stubbed Copilot answer for #343.' }
        : { functionCall: { name: 'get_project_summary', args: {} }, modelPart: callPart },
    });
  });

  await openProject(page, PROJECT);
  await page.getByRole('button', { name: 'Open Spark Copilot' }).click();
  await page.getByPlaceholder('Type your question… (Shift+Enter for newline)').fill('Summarize this project');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('Stubbed Copilot answer for #343.')).toBeVisible({ timeout: 30_000 });
  expect(bodies).toHaveLength(2);
  expect((bodies[1]!.toolResult as Record<string, unknown>).modelPart).toEqual(callPart); // main: no modelPart
  for (const body of bodies) expect(body).not.toHaveProperty('model'); // main: 'gemini-2.5-flash'
});

test('#343 2 the deployed proxy completes a tool round trip on Gemini 3', async ({ page }) => {
  expect(SUPABASE_URL, 'VITE_SUPABASE_URL (.env.local)').toBeTruthy();
  await openProject(page, PROJECT);
  const result = await page.evaluate(async (url) => {
    const key = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k))!;
    const token = JSON.parse(localStorage.getItem(key)!).access_token;
    const call = async (body: unknown) => {
      const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      return { status: r.status, json: await r.json() };
    };
    const prompt = 'What is the connected load on panel MDP? Use the tool.';
    const tool = { name: 'get_panel_load', description: 'Get the connected load of a panel by name', parameters: { type: 'object', properties: { panel_name: { type: 'string' } }, required: ['panel_name'] } };
    const first = await call({ prompt, tools: [tool], model: 'gemini-2.0-flash-exp' }); // a caller's model is ignored
    const second = await call({ prompt, toolResult: { toolName: 'get_panel_load', result: { panel: 'MDP', load_va: 21300 }, modelPart: first.json.modelPart } });
    return { first, second };
  }, `${SUPABASE_URL}/functions/v1/${PROXY_FUNCTION}`);

  expect(result.first.status).toBe(200); // main: 400 "models/gemini-2.0-flash-exp is not found"
  expect(result.first.json.functionCall?.name).toBe('get_panel_load');
  expect(result.first.json.modelPart?.thoughtSignature, 'Gemini 3 signs its function calls').toBeTruthy();
  expect(result.second.status).toBe(200); // main on Gemini 3: 400 "Role 'function' is not supported"
  expect(result.second.json.response).toMatch(/21[,.]?3/);
});

test('#343 3 RFIs: Extract from PDF fills the RFI from the PDF', async ({ page }) => {
  test.setTimeout(120_000);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const lines = [
    'REQUEST FOR INFORMATION  RFI-343',
    'Subject: Grounding electrode conductor size at the service',
    'Question: Please confirm the grounding electrode conductor size for the 400 A',
    'service per NEC Table 250.66, given 500 kcmil copper service conductors.',
    'Priority: High        Requested by: QA Electrical',
  ];
  const sheet = pdf.addPage([612, 792]);
  lines.forEach((text, i) => sheet.drawText(text, { x: 50, y: 720 - i * 22, size: 12, font }));
  const bytes = Buffer.from(await pdf.save());
  if (PROXY_FUNCTION !== 'gemini-proxy') {
    await page.route(PROXY, route => route.continue({ url: route.request().url().replace(/gemini-proxy$/, PROXY_FUNCTION) }));
  }

  const projectUrl = await openProject(page, PROJECT);
  await page.goto(`${projectUrl}/rfis`);
  await page.getByRole('button', { name: /create rfi/i }).first().click();
  await page.getByRole('button', { name: /extract from pdf/i }).click();
  await page.locator('input[type="file"][accept="application/pdf"]').setInputFiles({ name: 'rfi-343.pdf', mimeType: 'application/pdf', buffer: bytes });
  await page.getByRole('button', { name: /extract rfi data with ai/i }).click();

  // main: "Extraction failed" (models/gemini-2.0-flash-exp is not found)
  await expect(page.getByPlaceholder('Brief subject of the RFI...')).toHaveValue(/grounding electrode/i, { timeout: 90_000 });
  await expect(page.getByPlaceholder('Detailed question or information request...')).toHaveValue(/250\.66/);
});

test('#343 6 a LaTeX answer shows as plain text, prices untouched', async ({ page }) => {
  // The verifier's 2026-11-25 answer: Gemini 3 wrote LaTeX despite the instruction
  const answer = 'Line current:\n\n$$\\text{Current (I)} = \\frac{\\text{Apparent Power (S)}}{\\text{Line-to-Line Voltage (V)} \\times \\sqrt{3}}$$\n\nEstimated cost: $5,700–$14,000; markup is $\\$588.00$.';
  await page.route(PROXY, async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 200, headers: CORS });
    return route.fulfill({ headers: CORS, json: { response: answer } });
  });

  await openProject(page, PROJECT);
  await page.getByRole('button', { name: 'Open Spark Copilot' }).click();
  await page.getByPlaceholder('Type your question… (Shift+Enter for newline)').fill('How do I get the line current?');
  await page.getByRole('button', { name: 'Send message' }).click();

  const shown = page.locator('.prose').filter({ hasText: 'Line current:' }).last();
  await expect(shown).toContainText('Current (I) = (Apparent Power (S)) / (Line-to-Line Voltage (V) × √3)', { timeout: 30_000 });
  await expect(shown).toContainText('Estimated cost: $5,700–$14,000; markup is $588.00.');
  await expect(shown).not.toContainText('\\frac'); // main: the LaTeX printed raw
});
