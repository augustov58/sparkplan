import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #299 (regression from #283): a 3-phase "Panel Max Capacity" feeder is not
 * Outdated against its own panel main, and every reader sizes it for that
 * capacity. Expected values: the issue's Acceptance section (hand-calculated):
 * 400.0 A, 2 × 250 kcmil Cu, VD 2.28 V = 0.47 %.
 *
 * QA project "QA SC parallel" (feeder MDP → DP-1). The spec sets the feeder
 * breaker to 350 A and always puts it back to the default (blank → 400 A).
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-299';
mkdirSync(OUT, { recursive: true });

async function openProject(page: Page) {
  await page.goto('/');
  const card = page.getByText('QA SC parallel', { exact: true }).first();
  await expect(card, 'QA project "QA SC parallel" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  return page.url().replace(/(#\/project\/[^/?]+).*/, '$1');
}

async function saveBreaker(page: Page, breaker: string) {
  const main = page.locator('main');
  await main.locator('button[title="Edit"]').first().click();
  await main.getByRole('button', { name: 'Panel Max Capacity' }).click();
  const field = main.getByLabel('Feeder breaker (A)');
  if (!(await field.isVisible().catch(() => false))) await main.getByRole('button', { name: /Advanced Calculation Options/ }).click();
  await field.fill(breaker);
  await main.getByRole('button', { name: 'Calculate & Save' }).click();
  await expect(main.getByRole('button', { name: 'Calculate & Save' })).toBeHidden({ timeout: 15_000 });
}

const cardText = async (page: Page) => (await page.locator('main').innerText()).replace(/\s+/g, ' ');

test('#299 a 3-phase Panel Max Capacity feeder is not Outdated and prints the same everywhere', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  const projectUrl = await openProject(page);
  const main = page.locator('main');
  let failure: unknown;
  try {
    // 1: not Outdated; the voltage-drop export counts the feeder
    await page.goto(`${projectUrl}/feeders`);
    await expect.poll(() => cardText(page), { timeout: 20_000 }).toMatch(/Phase: 250 kcmil .*Breaker: 400 A .*Sets: 2× Load: 332\.6 kVA VD: 0\.47%/);
    let t = await cardText(page);
    expect(t).not.toContain('Outdated'); // main: Outdated, "Design current 400.0 A exceeds the 400 A feeder breaker"
    expect(t).not.toContain('Needs Recalculation');
    expect(t).not.toMatch(/exceeds DP-1's 400 A rating/);
    await expect(main.getByRole('button', { name: /Export Voltage Drop Report/ })).toBeEnabled();

    // 2: Recalculate keeps it
    await main.locator('button[title="Recalculate"]').first().click();
    await page.waitForTimeout(2_000);
    expect(await cardText(page)).not.toContain('Outdated');

    // 4: the packet
    await page.goto(`${projectUrl}/permit-packet`);
    const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
    await expect(generate).toBeEnabled({ timeout: 20_000 });
    await page.waitForTimeout(2_000);
    const download = page.waitForEvent('download', { timeout: 120_000 });
    await generate.click();
    const pdf = join(OUT, 'packet.pdf');
    await (await download).saveAs(pdf);
    const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
    expect(text).toMatch(/MDP -> DP-1 MDP -> DP-1\s+100 ft\s+2× 250 kcmil Cu\s+400\.0 A\s+2\.28\s+0\.47%/); // main: 4/0 AWG Cu 0.0 A
    expect(text).toMatch(/MDP -> DP-1\s+MDP\s+DP-1\s+2× 250 kcmil\s+332\.6/); // main: "250 kcmil"

    // 3: a breaker below the design current is still caught
    await page.goto(`${projectUrl}/feeders`);
    await saveBreaker(page, '350');
    await expect.poll(() => cardText(page)).toContain('Design current 400.0 A exceeds the 350 A feeder breaker');
  } catch (e) {
    failure = e;
  }
  try {
    await page.goto(`${projectUrl}/feeders`);
    await saveBreaker(page, '');
  } catch (e) {
    if (!failure) throw e;
  }
  if (failure) throw failure;
  await expect.poll(() => cardText(page)).toMatch(/Breaker: 400 A/);
  expect(await cardText(page)).not.toContain('Outdated');
});
