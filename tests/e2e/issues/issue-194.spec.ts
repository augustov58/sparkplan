import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #194 — the EVEMS Load Management tool takes EV load at 100% (no EVSE demand
 * factor), adds 25% in the service check (230.42(A)(1)), and sizes the EVEMS
 * setpoint so its 125% fits 90% of the available capacity.
 * Expected values: the hand calculation in the issue's Acceptance section.
 * QA project: tests/e2e/fixtures.md.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-194';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = 'QA EVEMS tool (NEC 2023)';

test('#194 EVEMS tool: EV load at 100% + 25% service-check adder', async ({ page }) => {
  test.setTimeout(90_000);

  // The welcome modal opens while the project list is still loading
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/tools'));
  await page.getByRole('button', { name: /EVEMS Load Mgmt/ }).click();

  const results = page.locator('h3', { hasText: 'Load Management Analysis' }).locator('..');
  const quantity = page.locator("xpath=//label[normalize-space()='Quantity']/following-sibling::input");
  const evems = page.locator('#useEVEMS');
  const expectAll = async (texts: string[]) => {
    for (const t of texts) await expect(results).toContainText(t);
  };
  const guardrails = ['48.00 kVA', '24.00 kVA'];

  // 1 — four Level 2 chargers (32 A, 240 V), no EVEMS
  await quantity.fill('4');
  await expectAll([
    ...guardrails,
    'EV Load: 30.7 kVA',
    'Continuous +25%: 7.7 kVA',
    'Total: 62.4 kVA',
    '130.0%',
    '400A',
    'reduce required capacity by up to 16.8 kVA',
    'NEC 220.57(A)',
    'NEC 230.42(A)(1)',
  ]);
  await expect(results).not.toContainText('625.44');
  await expect(results).not.toContainText(/Demand factor of/i);
  const maxChargers = page.locator('h4', { hasText: 'Maximum Chargers' }).locator('..');
  await expect(maxChargers).toContainText(/Without EVEMS\s*2\s*With EVEMS\s*2/);
  await shot(page, '1-qty4');

  // 2 — twelve chargers
  await quantity.fill('12');
  await expectAll([
    ...guardrails,
    'EV Load: 92.2 kVA',
    'Continuous +25%: 23.0 kVA',
    'Total: 139.2 kVA',
    '290.0%',
    '800A',
    'reduce required capacity by up to 93.6 kVA',
  ]);
  await shot(page, '2-qty12');

  // 3 — four chargers with EVEMS: setpoint 17.28 kVA
  await quantity.fill('4');
  await evems.check();
  await expectAll([
    ...guardrails,
    'EV Load (setpoint): 17.3 kVA',
    'Continuous +25%: 4.3 kVA',
    'Total: 45.6 kVA',
    '95.0%',
    'NEC 625.42',
  ]);
  await expect(results).not.toContainText('Service Upgrade Required');
  await shot(page, '3-evems');

  // 4 — one Level 1 charger under NEC 2023: the 220.57(A) 7,200 VA floor
  await evems.uncheck();
  await page.locator("xpath=//label[normalize-space()='Level']/following-sibling::select").selectOption('Level1');
  await quantity.fill('1');
  await expectAll([
    ...guardrails,
    'EV Load: 7.2 kVA',
    'Continuous +25%: 1.8 kVA',
    'Total: 33.0 kVA',
    '68.8%',
  ]);
  await expect(maxChargers).toContainText(/Without EVEMS\s*2\s*With EVEMS\s*2/);
  await shot(page, '4-level1');
});
