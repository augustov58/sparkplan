import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #195 — the Commercial Load Calculator takes continuous HVAC and special loads
 * at 100% in the load total; their 125% is in service sizing only.
 * Expected values: the hand calculation in the issue's Acceptance section.
 * QA project: tests/e2e/fixtures.md.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/issue-195';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = 'QA Commercial calc';

test('#195 Commercial Load Calculator: continuous loads at 100% in the load total', async ({ page }) => {
  test.setTimeout(90_000);

  // The welcome modal opens while the project list is still loading
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded'); // not networkidle: realtime keeps the dashboard busy; the next step waits for what it needs
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  // The calculator keeps its inputs in sessionStorage: a new context starts from the defaults
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/load-calc'));

  const breakdown = page.locator('h3', { hasText: 'Load Breakdown' }).locator('..');
  const row = (category: string) => breakdown.locator('div.space-y-2 > div', { hasText: category });
  const summary = page.getByText('Calculated Load', { exact: true }).locator('../..');
  // Label and value are separate cells: textContent has no space between them
  const cells = (connected: string, demand: string, factor: string, service: string) =>
    new RegExp(`Connected\\s*${connected} kVA\\s*Demand\\s*${demand} kVA\\s*Factor\\s*${factor}%\\s*Service\\s*${service} kVA`.replace(/\./g, '\\.'));
  const expectSummary = async (amps: string, demand: string) => {
    await expect(summary).toContainText(new RegExp(`Calculated Load\\s*${amps.replace('.', '\\.')} A`));
    await expect(summary).toContainText(new RegExp(`Total Demand\\s*${demand.replace('.', '\\.')} kVA`));
  };
  const hvacContinuous = page.locator('label', { hasText: 'Continuous (125%)' }).first().locator('input');
  const special = page.locator('h3', { hasText: 'Special Loads' }).locator('../..');
  const addSpecial = page.locator('h3', { hasText: 'Special Loads' }).locator('..').getByRole('button').first();

  // 1 — defaults: one continuous rooftop unit (42 A, 208 V, 3-phase)
  await expect(row('HVAC Equipment')).toContainText(cells('15.1', '15.1', '100', '18.9'));
  await expect(row('HVAC Equipment')).toContainText('×1.25');
  await expectSummary('113.6', '37.1');
  await expect(row('General Lighting')).toContainText(cells('13.0', '13.0', '100', '13.0'));
  await expect(row('Receptacles')).toContainText(cells('9.00', '9.00', '100', '9.00'));
  await shot(page, '1-defaults');

  // 2 — not continuous: no 125% anywhere
  await hvacContinuous.uncheck();
  await expect(row('HVAC Equipment')).toContainText(cells('15.1', '15.1', '100', '15.1'));
  await expect(row('HVAC Equipment')).not.toContainText('×1.25');
  await expectSummary('103.1', '37.1');

  // 3 — a continuous special load of 10,000 VA
  await hvacContinuous.check();
  await addSpecial.click();
  await special.locator("xpath=.//label[normalize-space()='Load (VA)']/following-sibling::input").first().fill('10000');
  await special.locator('label', { hasText: 'Continuous (125%)' }).first().locator('input').check();
  await expect(row('Special Loads')).toContainText(cells('10.0', '10.0', '100', '12.5'));
  await expect(row('Special Loads')).toContainText('×1.25');
  await expectSummary('148.3', '47.1');
  await shot(page, '3-special-continuous');

  // 4 — plus a non-continuous 5,000 VA load: the 125% applies per load
  await addSpecial.click();
  await expect(row('Special Loads')).toContainText(cells('15.0', '15.0', '100', '17.5'));
  await expectSummary('162.1', '52.1');
  // The sizing note splits the mixed row: 9,000 + 5,000 non-continuous; 18,914 + 12,500 at 125%
  await expect(page.getByText('Service sizing per NEC')).toContainText(
    'Non-continuous (14000 VA) + Continuous loads at 125% (31414 VA)',
  );
  await shot(page, '4-special-mixed');
});
