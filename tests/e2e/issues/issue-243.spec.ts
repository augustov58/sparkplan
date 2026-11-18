import { test, expect } from '@playwright/test';

/**
 * #243 — the EV Panel Builder's number fields keep what the user types: "12"
 * is 12 chargers (each keystroke used to be clamped, so 1 → 11 → 112 → 20),
 * out-of-range values clamp on blur, and an empty field restores the last
 * valid value. Expected values: the issue's Acceptance section. QA project:
 * tests/e2e/fixtures.md. Read-only (nothing is created).
 */

const PROJECT_NAME = 'QA EV builder';

test('#243 the charger fields take typed numbers', async ({ page }) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(PROJECT_NAME, { exact: true }).first();
  await expect(card, `QA project "${PROJECT_NAME}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/tools');
  await page.getByRole('button', { name: 'EV Panel Builder' }).click();
  const main = page.locator('main');
  await expect(main).toContainText(/Total Circuits:\s*6/, { timeout: 15_000 });
  const chargers = main.locator('input[type=number]').first();

  // 1 — keystrokes, not fill: clear, then type "12" (was: Backspace snapped
  // to 1, so the keys gave 11, then 112, clamped to 20)
  await chargers.click();
  await chargers.press('ControlOrMeta+a');
  await chargers.press('Backspace');
  await chargers.pressSequentially('12');
  await expect(chargers).toHaveValue('12');
  await expect(main).toContainText('12 EV Circuits');
  await expect(main).toContainText(/Total Circuits:\s*14/);
  await expect(main).toContainText(/Demand Load \(NEC 220\):\s*583\.5 A/);
  await expect(main).toContainText(/Bus Design Load \(NEC 408\.30\):\s*727\.5 A/);
  await expect(main).toContainText(/Panel Utilization \(bus design load ÷ rating\)\s*91%/);

  // 2 — out of range clamps on blur
  await chargers.press('ControlOrMeta+a');
  await chargers.pressSequentially('25');
  await chargers.blur();
  await expect(chargers).toHaveValue('20');

  // 3 — an empty field restores the last valid value (was: 1 at once)
  await chargers.press('ControlOrMeta+a');
  await chargers.pressSequentially('4');
  await chargers.press('ControlOrMeta+a');
  await chargers.press('Backspace');
  await expect(main).toContainText(/Total Circuits:\s*6/); // still 4 chargers while empty
  await chargers.blur();
  await expect(chargers).toHaveValue('4');

  // 4 — simultaneous chargers, typed
  await page.locator('label[for="ev-builder-evems"]').click();
  const simultaneous = main.locator('input[type=number]').nth(1);
  await simultaneous.click();
  await simultaneous.press('ControlOrMeta+a');
  await simultaneous.pressSequentially('2');
  await expect(main).toContainText(/Demand Load \(NEC 220, EVEMS setpoint\):\s*103\.5 A/);
});
