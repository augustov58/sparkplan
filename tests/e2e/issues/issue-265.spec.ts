import { test, expect, type Page } from '@playwright/test';

/**
 * #265 — the EV Panel Builder warns (advisory) when the panel it creates
 * doesn't match the service's voltage or phase. Expected: the issue's
 * Acceptance section. Read-only (the builder preview).
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

async function openBuilder(page: Page, name: string) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(name, { exact: true }).first();
  await expect(card, `QA project "${name}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1/tools'));
  await page.getByRole('button', { name: 'EV Panel Builder' }).click();
  return page.getByTestId('ev-builder-supply-mismatch');
}

test('#265 a 480 V 3Φ DC fast panel on a 240 V 1Φ service is flagged; Level 2 is not', async ({ page }) => {
  const mismatch = await openBuilder(page, 'QA EV builder');
  await expect(page.locator('main')).toContainText('Custom EV Panel Builder');
  await expect(mismatch).toHaveCount(0); // Level 2 (48A): 240 V 1Φ on a 240 V 1Φ MDP
  await page.getByText('DC Fast Charge (150kW)', { exact: true }).first().click();
  await expect(mismatch).toContainText('This panel is 480V 3-phase; the service (MDP) is 240V 1-phase.');
  // 1Φ → 3Φ: a transformer can't make 3-phase; a new 3-phase service is the only path
  await expect(mismatch).toContainText('Needs a separate 3-phase service');
  await expect(mismatch).toContainText('it needs a new 480V 3-phase service from the utility');
  await expect(mismatch).not.toContainText('plan a transformer');
  await expect(page.getByRole('button', { name: /Create EV Panel/ })).toBeEnabled(); // advisory, not a gate
});

test('#265 a 240 V 1Φ Level 2 panel on a 208 V 3Φ service is flagged', async ({ page }) => {
  const mismatch = await openBuilder(page, 'QA Commercial panel');
  await expect(mismatch).toContainText('This panel is 240V 1-phase; the service (MDP) is 208V 3-phase.');
  await expect(mismatch).toContainText('plan a transformer between them, or a separate 240V 1-phase service.');
});
