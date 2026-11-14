import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #199 — the EVEMS tool's load schedule caps each slot's EV charging at the
 * EVEMS setpoint and includes the 25% service-check adder; peak "other" is
 * capped at the existing demand entered (owner ruling 2026-11-13).
 * Expected values: the hand calculation in the issue's Acceptance section.
 * QA project: tests/e2e/fixtures.md.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-199';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = 'QA EVEMS tool (NEC 2023)';

type Slot = { name: RegExp; util: string; ev: string; adder: string; other: string; available: string };

test('#199 EVEMS load schedule: EV capped at the setpoint, 25% adder in every slot', async ({ page }) => {
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

  const quantity = page.locator("xpath=//label[normalize-space()='Quantity']/following-sibling::input");
  const results = page.locator('h3', { hasText: 'Load Management Analysis' }).locator('..');
  const schedule = page.locator('h4', { hasText: 'Load Schedule' }).locator('..');
  const expectSlots = async (slots: Slot[]) => {
    for (const s of slots) {
      const slot = schedule.locator('div.border', { hasText: s.name });
      for (const t of [`${s.util} utilized`, `EV: ${s.ev} kVA`, `+25%: ${s.adder} kVA`, `Other: ${s.other} kVA`, `Available: ${s.available} kVA`]) {
        await expect(slot).toContainText(t);
      }
    }
  };

  await page.locator('#useEVEMS').check();

  // 1 — four chargers: setpoint 17.28 kVA caps off-peak and daytime
  await quantity.fill('4');
  await expect(results).toContainText('EV Load (setpoint): 17.3 kVA');
  await expect(results).toContainText('Total: 45.6 kVA');
  await expect(results).toContainText('95.0%');
  await expectSlots([
    { name: /Peak Hours \(6PM/, util: '90.0%', ev: '15.4', adder: '3.8', other: '24.0', available: '4.8' },
    { name: /Off-Peak Hours/, util: '75.0%', ev: '17.3', adder: '4.3', other: '14.4', available: '12.0' },
    { name: /Daytime Hours/, util: '95.0%', ev: '17.3', adder: '4.3', other: '24.0', available: '2.4' },
  ]);
  await shot(page, '1-qty4');

  // 2 — two chargers: setpoint 15.36 kVA; the time-of-day shares are below it
  await quantity.fill('2');
  await expect(results).toContainText('EV Load (setpoint): 15.4 kVA');
  await expect(results).toContainText('Total: 43.2 kVA');
  await expectSlots([
    { name: /Peak Hours \(6PM/, util: '70.0%', ev: '7.7', adder: '1.9', other: '24.0', available: '14.4' },
    { name: /Off-Peak Hours/, util: '66.0%', ev: '13.8', adder: '3.5', other: '14.4', available: '16.3' },
    { name: /Daytime Hours/, util: '78.0%', ev: '10.8', adder: '2.7', other: '24.0', available: '10.6' },
  ]);
  await shot(page, '2-qty2');
});
