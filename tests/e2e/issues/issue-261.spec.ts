import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #261 — non-dwelling receptacle demand cites 220.44 (NEC 2020) / 220.47
 * (NEC 2023). Expected: the issue's Acceptance section. Read-only.
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-261';
mkdirSync(OUT, { recursive: true });

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

for (const [name, section] of [['QA Commercial panel', '220.44'], ['QA Commercial 2023', '220.47']] as const) {
  test(`#261 receptacle demand cites ${section} (${name})`, async ({ page }) => {
    let main = await openTab(page, name, 'panel');
    await expect(main).toContainText(new RegExp(`Receptacles\\s*1\\.80\\s*1\\.00\\s*1\\.80\\s*(NEC )?${section.replace('.', '\\.')}`));
    main = await openTab(page, name, 'load-calc');
    await expect(main).toContainText(`NEC 220.14, ${section}`);
  });
}

test('#261 the NEC 2023 packet E-101 cites 220.47 for receptacles', async ({ page }) => {
  test.setTimeout(150_000);
  await openTab(page, 'QA Commercial 2023', 'permit-packet');
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000);
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, 'packet-2023.pdf');
  await (await download).saveAs(pdf);
  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  expect(text).toMatch(/Receptacles\s+1\.80\s+100%\s+1\.80\s+NEC 220\.47/);
  expect(text).not.toMatch(/220\.44/);
});
