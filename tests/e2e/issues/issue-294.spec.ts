import { test, expect, type Page } from '@playwright/test';

/**
 * #294 (owner ruling 2026-11-22, b): panel-template circuits carry their own
 * load and are legal on their breaker. Expected values: the issue's
 * Acceptance section (hand-calculated): loads at breaker ÷ 1.25 (3Φ 480 V:
 * 66,500 W = 80.0 A → 22.17 kVA per phase; 53,200 W → 17.73; 39,900 W →
 * 13.30; Retail lighting 1,920 W = 16 A at 120 V), 1 AWG on the 100 A rows,
 * 3 AWG on the 80 A row.
 *
 * The spec creates a project from each of the three templates in the QA
 * account, reads its panel schedule and material take-off, and deletes it.
 */

const TEMPLATES = [
  {
    tab: 'Commercial', name: 'Office Building (5000 sq ft)',
    rows: [/Transformer 1 \(75 kVA\) O 25\.00 25\.00 25\.00 100 3/, /3 100 22\.17 22\.17 22\.17 O Chiller \(100A\)/], // main: 26.67
    wire: [/Copper Wire 1 AWG \d+ ft 2 circuits/], // main: 3 AWG, 2 circuits
  },
  {
    tab: 'Industrial', name: 'Small Workshop/Light Manufacturing',
    rows: [/CNC Mill \(60A\) O 13\.30 13\.30 13\.30 60 3/, /3 60 13\.30 13\.30 13\.30 O CNC Lathe/, /Compressor \(100A\) O 22\.17 22\.17 22\.17 100 3/,
      /3 80 17\.73 17\.73 17\.73 O HVAC Unit \(80A\)/, /Transformer for 208V Panel O 40\.00 40\.00 40\.00 150 3/],
    wire: [/Copper Wire 6 AWG \d+ ft 3 circuits/, /Copper Wire 1 AWG \d+ ft 1 circuits/, /Copper Wire 3 AWG \d+ ft 1 circuits/, /Copper Wire 1\/0 AWG \d+ ft 1 circuits/],
  },
  {
    tab: 'Commercial', name: 'Retail Store (2500 sq ft)',
    rows: [/Sales Floor Lighting Zone 1 O 1\.92 20 1/, /Sales Floor Lighting Zone 2 O 1\.92 20 1/, /20 2\.40 O Cash Register Area/], // main: 3.00
    wire: [/Copper Wire 12 AWG \d+ ft 10 circuits/],
  },
];

async function deleteProjects(page: Page, name: string) {
  const main = page.locator('main');
  await page.goto('/');
  // The project list loads after the page: wait for a known QA project before counting
  await expect(main.locator('h3', { hasText: 'QA Short circuit' }).first()).toBeVisible({ timeout: 20_000 });
  for (let i = 0; i < 5; i++) {
    const heading = main.locator('h3').filter({ hasText: new RegExp(`^${name.replace(/[()/]/g, '\\$&')}$`) });
    if (!(await heading.count())) return;
    const card = heading.first().locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
    await card.hover();
    // The card leaves the list before the delete reaches the database; wait for
    // the request, or the next navigation cancels it and the project stays.
    const deleted = page.waitForResponse((r) => r.url().includes('/rest/v1/projects') && r.request().method() === 'DELETE');
    await card.locator('button[title="Delete project"]').click();
    expect((await deleted).ok()).toBe(true);
  }
}

test('#294 template circuits carry their load on a legal conductor', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  page.on('dialog', (d) => d.accept()); // "Are you sure you want to delete this project?"
  const main = page.locator('main');

  for (const t of TEMPLATES) {
    await deleteProjects(page, t.name); // a failed run may have left one
    let failure: unknown;
    try {
      await main.getByRole('button', { name: 'Create New NEC Project' }).click();
      await page.getByRole('button', { name: t.tab, exact: true }).click();
      await page.getByRole('button', { name: new RegExp(t.name.replace(/[()/]/g, '\\$&')) }).click();
      await page.getByRole('button', { name: 'Use This Template' }).click();
      await page.waitForURL(/#\/project\/[^/]+/, { timeout: 20_000 });
      const projectUrl = page.url().replace(/(#\/project\/[^/?]+).*/, '$1');

      await page.goto(`${projectUrl}/panel`);
      await expect(main.locator('tr').first()).toBeVisible({ timeout: 20_000 });
      await expect.poll(async () => (await main.locator('tr').allInnerTexts()).map((r) => r.replace(/\s+/g, ' ')).join('\n'), { timeout: 20_000 })
        .toMatch(t.rows[0]);
      const rows = (await main.locator('tr').allInnerTexts()).map((r) => r.replace(/\s+/g, ' ')).join('\n');
      for (const row of t.rows) expect(rows).toMatch(row);

      await page.goto(`${projectUrl}/materials`);
      await expect(main.getByText('Wire & Cable')).toBeVisible({ timeout: 20_000 });
      const materials = (await main.innerText()).replace(/\s+/g, ' ');
      for (const wire of t.wire) expect(materials).toMatch(wire);
    } catch (e) {
      failure = e;
    }
    await deleteProjects(page, t.name);
    if (failure) throw failure;
  }
});
