import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #198 — the EV Charging calculator takes EV load at 100% (no EVSE demand
 * factor). "Simultaneous use %" is a design assumption shown outside the NEC
 * load (PE ruling 2026-11-13).
 * Expected values: the hand calculation in the issue's Acceptance section.
 * QA project: tests/e2e/fixtures.md.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-198';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = 'QA EVEMS tool (NEC 2023)';

test('#198 EV Charging calculator: EV load at 100%, simultaneous use as a design assumption', async ({ page }) => {
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
  await page.getByRole('button', { name: /EV Charging \(NEC 625\)/ }).click();

  const field = (label: string) =>
    page.locator(`xpath=//label[starts-with(normalize-space(), '${label}')]/following-sibling::*[1]`);
  const results = page.locator('h3', { hasText: 'Sizing Results' }).locator('..');
  const setInputs = async (qty: string, pct: string) => {
    await field('Number of Chargers').fill(qty);
    await field('Simultaneous Use').fill(pct);
    await field('Circuit Length').click();
  };
  // Label and value are separate grid cells: textContent has no space between them
  const loose = (t: string) =>
    new RegExp(t.split(': ').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(':\\s*'));
  const expectAll = async (texts: string[]) => {
    for (const t of texts) await expect(results).toContainText(loose(t));
  };
  const refs = ['NEC 625.41', 'NEC 625.42', 'NEC 220.57(A)'];
  const noFactor = async () => {
    await expect(results).not.toContainText('625.44');
    await expect(results).not.toContainText('Demand Factor:'); // the old row label
    await expect(results).not.toContainText('Demand Load:');
  };

  // 1 — four Level 2 chargers (32 A, 240 V), 100%
  await setInputs('4', '100');
  await expectAll([
    ...refs,
    'Total Connected Load: 30.72 kVA',
    'NEC Load (100%, NEC 220.57(A)): 30.72 kVA',
    'Expected peak at 100% simultaneous use: 30.72 kVA',
    'Circuit Breaker: 40A',
    'Conductor Size: 8 AWG',
    'EGC Size: 10 AWG',
    '1.04%',
  ]);
  await noFactor();
  await shot(page, '1-qty4');

  // 2 — twelve chargers at 60%: the NEC load stays at 100%
  await setInputs('12', '60');
  await expectAll([
    'Total Connected Load: 92.16 kVA',
    'NEC Load (100%, NEC 220.57(A)): 92.16 kVA',
    'Expected peak at 60% simultaneous use: 55.3 kVA',
  ]);
  await noFactor();
  await shot(page, '2-qty12-60pct');

  // 3 — two chargers at 50%: exactly 50%, no × 1.1
  await setInputs('2', '50');
  await expectAll([
    'NEC Load (100%, NEC 220.57(A)): 15.36 kVA',
    'Expected peak at 50% simultaneous use: 7.68 kVA',
  ]);
  await shot(page, '3-qty2-50pct');

  // 4 — one Level 1 charger (120 V / 16 A) under NEC 2023: the 7,200 VA floor
  await field('Charger Level').selectOption('Level1');
  await setInputs('1', '100');
  await expectAll([
    'Total Connected Load: 1.92 kVA',
    'NEC Load (100%, NEC 220.57(A)): 7.2 kVA',
    'Expected peak at 100% simultaneous use: 1.92 kVA',
    'Circuit Breaker: 20A',
    'Conductor Size: 12 AWG',
    '2.63%',
  ]);
  await noFactor();
  await shot(page, '4-level1');
});
