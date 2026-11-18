import { test, expect, type Page } from '@playwright/test';

/**
 * #237 — Article 220 citations follow the project's NEC edition:
 * dwelling unit load 220.14(J) / 220.41, non-dwelling unit loads Table 220.12 /
 * 220.42(A), lighting demand Table 220.42 / 220.45. Expected: the issue's
 * Acceptance section. Read-only.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
});

async function openTab(page: Page, name: string, tab: string) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');
  const card = page.getByText(name, { exact: true }).first();
  await expect(card, `QA project "${name}" (tests/e2e/fixtures.md) is missing`).toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, `$1/${tab}`));
  return page.locator('main');
}

for (const [name, table] of [['QA Commercial panel', 'Table 220.12'], ['QA Commercial 2023', 'Table 220.42(A)']] as const) {
  test(`#237 Commercial Load Calculator cites ${table} (${name})`, async ({ page }) => {
    const main = await openTab(page, name, 'load-calc');
    await expect(main).toContainText(`General Lighting (Continuous - 125% included in ${table})`);
    await expect(main).toContainText(`per NEC ${table} (Office)`);
    await expect(main).toContainText(`Lighting from ${table} (13000 VA, 125% already included)`);
  });
}

for (const [name, table] of [['QA Commercial panel', 'Table 220.42 (All others)'], ['QA Commercial 2023', 'Table 220.45 (All others)']] as const) {
  test(`#237 Panel Schedule demand row cites ${table} (${name})`, async ({ page }) => {
    const main = await openTab(page, name, 'panel');
    await expect(main).toContainText(new RegExp(`Lighting\\s*3\\.00\\s*1\\.00\\s*3\\.00\\s*${table.replace(/[.()]/g, '\\$&')}`));
  });
}

test('#237 Dwelling Load Calculator: 220.14(J) on NEC 2020, 220.41 on NEC 2023', async ({ page }) => {
  let main = await openTab(page, 'QA SF subpanel', 'load-calc');
  await expect(main).toContainText('2,400 sq ft × 3 VA/sq ft (NEC 220.14(J))');
  await expect(main).toContainText('Per-Category Demand Factors (220.42 / 220.52 / 220.55 / 220.60)');
  main = await openTab(page, 'QA EVEMS tool (NEC 2023)', 'load-calc');
  await expect(main).toContainText('2,000 sq ft × 3 VA/sq ft (NEC 220.41)');
  await expect(main).not.toContainText('Table 220.12');
});
