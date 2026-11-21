import { test, expect, type Page } from '@playwright/test';

/**
 * #283 — a feeder has its own breaker (owner ruling 2026-11-21, option b).
 * QA project "QA SF subpanel 217" (tests/e2e/fixtures.md): feeder "Main Panel →
 * Pool Subpanel", 5,355 VA → 22.31 A, 4 current-carrying conductors. Expected
 * values: the issue's Acceptance section (hand-calculated). The spec edits the
 * feeder's breaker and basis and always restores it ("Calculated Load", blank
 * breaker → 10 AWG / EGC 10 AWG / 25 A).
 */

const FEEDER = 'Main Panel → Pool Subpanel';

async function openProject(page: Page) {
  await page.goto('/');
  await page.reload();
  const card = page.getByText('QA SF subpanel 217', { exact: true }).first();
  await expect(card, 'QA project "QA SF subpanel 217" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

/** The feeder card's text, spaces collapsed. */
async function cardText(page: Page) {
  const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  return text.match(new RegExp(`${FEEDER} ${FEEDER}.{0,260}`))?.[0] ?? '';
}

async function saveFeeder(page: Page, basis: 'Calculated Load' | 'Panel Max Capacity', breaker: string) {
  const main = page.locator('main');
  await main.locator('button[title="Edit"]').first().click();
  await main.getByRole('button', { name: basis }).click();
  const field = main.getByLabel('Feeder breaker (A)');
  if (!(await field.isVisible().catch(() => false))) await main.getByRole('button', { name: /Advanced Calculation Options/ }).click();
  await field.fill(breaker);
  await main.getByRole('button', { name: 'Calculate & Save' }).click();
  await expect(main.getByRole('button', { name: 'Calculate & Save' })).toBeHidden({ timeout: 15_000 });
}

test('#283 the feeder breaker: default, edited, Outdated, capacity basis kept', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  const project = await openProject(page);
  const main = page.locator('main');
  try {
    // 1–2: the default breaker, then Recalculate
    await page.goto(`${project}/feeders`);
    await expect.poll(() => cardText(page), { timeout: 20_000 }).toMatch(/Breaker: 25 A/);   // main: no breaker
    await main.locator('button[title="Recalculate"]').first().click();
    await expect.poll(() => cardText(page)).toMatch(/Phase: 10 AWG .*Breaker: 25 A EGC: 10 AWG/); // main: EGC 8 AWG

    // 3: the panel schedule's feeder row
    await page.goto(`${project}/panel`);
    await main.getByText('Main Panel').first().click();
    await expect(main.locator('tr', { hasText: 'Pool Subpanel' }).first()).toContainText('25A', { timeout: 20_000 }); // main: 100A

    // 4: a 60 A breaker → conductors protected by it
    await page.goto(`${project}/feeders`);
    await saveFeeder(page, 'Calculated Load', '60');
    await expect.poll(() => cardText(page)).toMatch(/Phase: 4 AWG .*Breaker: 60 A EGC: 10 AWG/);

    // 5: a 20 A breaker below the design current → Outdated, and Inspector Mode flags it
    await saveFeeder(page, 'Calculated Load', '20');
    await expect.poll(() => cardText(page)).toMatch(/Outdated .*Breaker: 20 A EGC: 12 AWG/);
    await expect(main.getByText('Design current 22.3 A exceeds the 20 A feeder breaker').first()).toBeVisible();
    await page.goto(`${project}/inspector`);
    await main.getByRole('button', { name: /Run Inspection/ }).first().click();
    await expect(main.getByText('Feeder Breaker Smaller Than Its Design Load').first()).toBeVisible({ timeout: 20_000 });

    // 6: Panel Max Capacity — the panel main, kept by Recalculate
    await page.goto(`${project}/feeders`);
    await saveFeeder(page, 'Panel Max Capacity', '');
    await expect.poll(() => cardText(page)).toMatch(/Breaker: 100 A EGC: 8 AWG .*Load: 24\.0 kVA/);
    await main.locator('button[title="Recalculate"]').first().click();
    await page.waitForTimeout(2_000);
    await expect.poll(() => cardText(page)).toMatch(/Breaker: 100 A EGC: 8 AWG .*Load: 24\.0 kVA/); // main: back to load-based
  } finally {
    // 7: restore the fixture
    await page.goto(`${project}/feeders`);
    await saveFeeder(page, 'Calculated Load', '');
  }
  await expect.poll(() => cardText(page)).toMatch(/Phase: 10 AWG .*Breaker: 25 A EGC: 10 AWG .*Load: 5\.4 kVA/);
  await expect(main.getByText('Outdated')).toHaveCount(0);
});
