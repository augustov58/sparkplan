import { test, expect, type Page } from '@playwright/test';
import { loadEnv } from 'vite';

/**
 * #334: the AI backend (Railway, VITE_PYTHON_API_URL) crashed at import on every
 * deploy since 2026-07-09 (an unpinned pydantic-ai 2.0), so the four AI features
 * failed with the raw platform response and a "localhost:8000" hint.
 *
 * 1  the deployed backend answers /health (fails until the fix is deployed)
 * 5  backend unreachable → "Draft RFI with AI" says the AI service is
 *    unavailable (the request is refused here, nothing is written)
 */

const { VITE_PYTHON_API_URL: BACKEND } = loadEnv('development', process.cwd(), 'VITE_PYTHON_');
const PROJECT = 'QA Commercial calc';
const UNAVAILABLE = 'The AI service is unavailable right now. Please try again in a few minutes.';

async function openProject(page: Page, name: string): Promise<string> {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText(name, { exact: true }).first();
  await expect(card, `QA project "${name}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

test('#334 1 the AI backend answers /health', async ({ request }) => {
  expect(BACKEND, 'VITE_PYTHON_API_URL (.env.local)').toBeTruthy();
  const res = await request.get(`${BACKEND}/health`, { timeout: 30_000 });
  expect(res.status()).toBe(200); // 2026-11-24 before the fix: 502 "Application failed to respond"
  expect((await res.json()).status).toBe('healthy');
});

test('#334 5 backend unreachable: Draft RFI with AI says the AI service is unavailable', async ({ page }) => {
  await page.route('**/api/agent-actions/**', route => route.abort('connectionrefused'));
  const projectUrl = await openProject(page, PROJECT);
  await page.goto(`${projectUrl}/rfis`);

  await page.getByRole('button', { name: /create rfi/i }).first().click();
  await page.getByRole('button', { name: /draft with ai/i }).click();
  await page.getByPlaceholder('e.g., Service entrance grounding requirements').fill('Grounding electrode conductor size');

  const dialog = page.waitForEvent('dialog');
  await page.getByRole('button', { name: /draft rfi with ai/i }).click();
  const alert = await dialog;
  const message = alert.message();
  await alert.dismiss();

  expect(message).toBe(`Failed to draft RFI: ${UNAVAILABLE}`); // main: "Failed to fetch" + "Make sure … localhost:8000"
});
