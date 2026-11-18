import { test, expect, Page } from '@playwright/test';

/**
 * #241 — the EV Panel Builder's NEC references say what each section does in
 * the builder (CLAUDE.md's recorded rulings), the EVSE-load line follows the
 * project's edition, and nothing cites an "EV Coupler" or EVSE "Demand
 * Factors". Expected: the issue's Acceptance section. Read-only.
 */

async function references(page: Page, project: string) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(project, { exact: true }).first();
  await expect(card, `QA project "${project}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/tools');
  await page.getByRole('button', { name: 'EV Panel Builder' }).click();
  const box = page.getByText('NEC References:').locator('..');
  await expect(box).toBeVisible({ timeout: 15_000 });
  return box;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

const COMMON = [
  "NEC 625.41 - EV branch circuit overcurrent protection and conductors at 125% of the charger's rating",
  'NEC 625.42 - EVEMS: the setpoint limits the load on the feeder and the service',
  'NEC 215.2(A)(1) / 230.42(A)(1) - Feeder and service: the load + 25% of the continuous loads (EV charging)',
  'NEC 408.30 - Panelboard rating: at least the feeder design load',
];

for (const [project, evseLine] of [
  ['QA EV builder', 'NEC 220.14(A) - EVSE load at the nameplate rating, at 100%'],
  ['QA EVEMS tool (NEC 2023)', 'NEC 220.57 - EVSE load: the larger of 7,200 VA or the nameplate rating, at 100%'],
] as const) {
  test(`#241 ${project}: references by what the builder does`, async ({ page }) => {
    const box = await references(page, project);
    await expect(box).toContainText(evseLine);
    for (const line of COMMON) await expect(box).toContainText(line);
    await expect(box).not.toContainText('Coupler'); // was "625.41 - Electric Vehicle Coupler"
    await expect(box).not.toContainText('Demand Factors'); // was "625.44 - … Demand Factors"
  });
}

test('#241 a project with no panels still previews the new panel (NEC 2023)', async ({ page }) => {
  await references(page, 'QA EVEMS tool (NEC 2023)');
  // 4 × max(7,200, 11,520) + 1,800 = 47,880 VA ÷ 240 (was "—": the preview needed an MDP)
  await expect(page.locator('main')).toContainText(/Demand Load \(NEC 220\):\s*199\.5 A \(47\.9 kVA\)/);
  await expect(page.locator('main')).toContainText(/Bus Design Load \(NEC 408\.30\):\s*247\.5 A/);
});

