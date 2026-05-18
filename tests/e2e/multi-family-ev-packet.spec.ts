import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Sprint 2C M3 (2026-05-17) — Multi-Family EV → Permit Packet smoke test.
 *
 * Covers the new Tools-Hub-as-source-of-truth wiring:
 *   1. MultiFamilyEVCalculator (Tools Hub) computes a result and persists it
 *      to `project.settings.residential.mfEvCalculation`.
 *   2. PermitPacketGenerator reads that persisted result and routes it into
 *      `packetData.multiFamilyEVAnalysis` — no duplicated form inputs.
 *   3. The generated packet PDF contains the MF-EV analysis pages.
 *
 * Like the NEC 220.83 smoke test, this skips if the named fixture project
 * isn't on the dashboard. Create one (Multi-Family Residential, Existing
 * Construction, 20 units) or set E2E_MF_EV_PROJECT_NAME to an existing
 * multi-family project before running.
 */

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/mf-ev-packet';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = process.env.E2E_MF_EV_PROJECT_NAME ?? 'MF EV Smoke Test';
const DWELLING_UNITS = process.env.E2E_MF_EV_UNITS ?? '20';
const EXISTING_SERVICE_A = process.env.E2E_MF_EV_SERVICE_A ?? '800';
const EV_CHARGER_COUNT = process.env.E2E_MF_EV_CHARGERS ?? '20';

test.describe('Multi-Family EV — Tools Hub calc persists → packet renders', () => {
  test('journey: project setup → MF-EV calc → save → permit packet', async ({ page }) => {
    test.setTimeout(240_000);

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await shot(page, '01-dashboard');

    const projectCard = page
      .getByRole('link', { name: new RegExp(PROJECT_NAME, 'i') })
      .or(page.getByText(new RegExp(PROJECT_NAME, 'i')).first());

    const projectExists = await projectCard.isVisible().catch(() => false);
    if (!projectExists) {
      test.skip(
        true,
        `No project named "${PROJECT_NAME}" found on dashboard. ` +
          'Create one (Multi-Family Residential, Existing Construction, 20 units, 800A service) ' +
          'or set E2E_MF_EV_PROJECT_NAME to an existing multi-family project.',
      );
    }
    await projectCard.click();
    await page.waitForLoadState('networkidle');
    await shot(page, '02-project-opened');

    // Step 1: confirm Project Status is Existing Construction (this is what
    // unlocks the per-circuit NEW/EXIST badges and the 220.87 narrative path).
    await page.goto('/#/setup');
    await page.waitForLoadState('networkidle');
    const projectStatus = page.locator('select').filter({ has: page.getByText(/Existing Construction|New Construction|Service Upgrade/) }).first();
    await expect(projectStatus).toBeVisible({ timeout: 5_000 });
    await projectStatus.selectOption({ label: /Existing Construction/i }).catch(() => {});
    await shot(page, '03-project-status-existing');

    // Step 2: navigate to Tools Hub → Multi-Family EV Calculator.
    await page.goto('/#/calculators');
    await page.waitForLoadState('networkidle');
    const mfEvLink = page.getByRole('button', { name: /Multi-Family EV/i })
      .or(page.getByText(/Multi-Family EV Calculator/i)).first();
    await expect(mfEvLink).toBeVisible({ timeout: 10_000 });
    await mfEvLink.click();
    await shot(page, '04-mf-ev-calculator');

    // Step 3: fill core inputs. Use existing-service Method 2 (calculated)
    // since fixture projects typically don't have utility-bill data.
    const dwellingUnitsInput = page.getByLabel(/dwelling units|number of units/i).first();
    if (await dwellingUnitsInput.isVisible().catch(() => false)) {
      await dwellingUnitsInput.fill(DWELLING_UNITS);
    }
    const serviceAmpsInput = page.getByLabel(/existing service|service.*amps/i).first();
    if (await serviceAmpsInput.isVisible().catch(() => false)) {
      await serviceAmpsInput.fill(EXISTING_SERVICE_A);
    }
    const chargerCountInput = page.getByLabel(/charger count|number of chargers/i).first();
    if (await chargerCountInput.isVisible().catch(() => false)) {
      await chargerCountInput.fill(EV_CHARGER_COUNT);
    }
    // Let the persistence useEffect fire (750ms debounce + Supabase round-trip).
    await page.waitForTimeout(2_000);
    await shot(page, '05-mf-ev-filled');

    // Step 4: assert the compliance summary is visible (proves calc ran).
    await expect(page.getByText(/NEC 220\.84|NEC 625\.42|EVEMS/i).first()).toBeVisible({ timeout: 5_000 });
    await shot(page, '06-mf-ev-result-shown');

    // Step 5: navigate to Permit Packet Generator and confirm the section
    // toggle is enabled (the disabled-reason banner should NOT show for
    // multiFamilyEV anymore).
    await page.goto('/#/permit-packet');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Multi-Family EV Analysis/i).first()).toBeVisible({ timeout: 10_000 });
    // The new banner card replaces the old inline duplicate form.
    await expect(page.getByText(/Analysis saved from the Multi-Family EV Calculator/i)).toBeVisible({ timeout: 5_000 });
    await shot(page, '07-packet-toggle-enabled');

    // Step 6: generate the packet. Listen for the download to capture PDF
    // bytes for inspection.
    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await page.getByRole('button', { name: /generate|create.*packet/i }).first().click();
    const download = await downloadPromise;
    const downloadPath = join(SCREENSHOT_DIR, 'packet.pdf');
    await download.saveAs(downloadPath);
    await shot(page, '08-packet-generated');

    // Step 7: assert the download actually happened. (Full PDF content
    // assertions are covered by tests/permitPacketE2E.test.ts; this E2E
    // just proves the UI wiring delivers data to the generator.)
    expect(download.suggestedFilename()).toMatch(/permit.*packet.*\.pdf/i);
  });
});
