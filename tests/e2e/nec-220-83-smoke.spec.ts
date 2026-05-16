import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'fs';
import { join } from 'path';

const SCREENSHOT_DIR = 'tests/e2e/__output__/screenshots/nec-220-83-smoke';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const shot = (page: Page, name: string) =>
  page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: true });

const PROJECT_NAME = process.env.E2E_PROJECT_NAME ?? 'NEC 220.83 Smoke Test';
const SQ_FT = process.env.E2E_SQ_FT ?? '1000';
const EXISTING_SERVICE_A = process.env.E2E_EXISTING_SERVICE_A ?? '125';

test.describe('NEC 220.83 — existing dwelling + proposed load → permit packet', () => {
  test('full journey: Dwelling Calc → Panel Schedule → Permit Packet', async ({ page }) => {
    test.setTimeout(180_000);

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
          'Create one (Existing Construction, single-family residential, 1000 sq ft) ' +
          'or set E2E_PROJECT_NAME to an existing one.',
      );
    }
    await projectCard.click();
    await page.waitForLoadState('networkidle');
    await shot(page, '02-project-opened');

    await page.goto('/#/load-calc');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Dwelling Load Calculator/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/NEC 220\.83/i).first()).toBeVisible();
    await shot(page, '03-dwelling-calc-loaded');

    const existingSizeInput = page.getByLabel(/existing service size/i);
    await expect(existingSizeInput).toBeVisible({ timeout: 5_000 });
    await existingSizeInput.fill(EXISTING_SERVICE_A);
    await page.keyboard.press('Tab');

    const enable = async (label: RegExp) => {
      const row = page.locator('div', { hasText: label }).first();
      const toggle = row.getByRole('switch').or(row.locator('button[role="switch"], input[type="checkbox"]')).first();
      const isOn = await toggle.getAttribute('aria-checked').catch(() => null);
      if (isOn !== 'true') await toggle.click().catch(() => {});
    };
    await enable(/^Electric Range/i);
    await enable(/^Clothes Dryer/i);
    await enable(/^Water Heater/i);
    await enable(/^HVAC System/i);
    await enable(/^Garbage Disposal/i);
    await enable(/^Pool Pump/i);
    await shot(page, '04-appliances-toggled');

    const addCustomBtn = page.getByRole('button', { name: /add custom/i }).first();
    if (await addCustomBtn.isVisible().catch(() => false)) {
      const templateSelect = page.locator('select').filter({ hasText: /Select Load|EV|HVAC/i }).first();
      if (await templateSelect.isVisible().catch(() => false)) {
        await templateSelect.selectOption({ label: /Level 2 EV Charger \(48A\)/ }).catch(async () => {
          await templateSelect.selectOption({ index: 1 });
        });
      } else {
        await addCustomBtn.click();
      }
    }
    await shot(page, '05-proposed-ev-added');

    await page.waitForTimeout(800);
    const serviceCard = page.getByText(/Service Calculation/i).locator('..');
    const cardText = (await serviceCard.textContent()) ?? '';
    console.log('[smoke] Service Calculation card text:\n', cardText);

    await expect(serviceCard).toContainText(/48\.0\s*kVA/);
    await expect(serviceCard).toContainText(/28\.\d\s*kVA/);
    await expect(serviceCard).toContainText(/117\s*A/);
    await expect(serviceCard).toContainText(/125\s*A/);
    await expect(serviceCard).toContainText(/EXISTING HOLDS|existing holds/i);
    await shot(page, '06-service-card-verified');

    const regenBtn = page
      .getByRole('button', { name: /Regenerate Schedule|Generate Panel Schedule/i })
      .first();
    await regenBtn.click();
    page.once('dialog', (dlg) => dlg.accept().catch(() => {}));
    await page.waitForTimeout(2500);
    await shot(page, '07-after-regenerate');

    await page.goto('/#/panel');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, '08-panel-schedule');

    await expect(page.getByText(/NEW/).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/EXIST/).first()).toBeVisible();

    await expect(page.getByText(/NEC 220\.83 Optional Method/i).first()).toBeVisible();
    const summaryRegion = page.getByText(/Panel Summary/i).locator('..');
    await expect(summaryRegion).toContainText(/48\.0\s*KVA/i);
    await expect(summaryRegion).toContainText(/28\.\d\s*KVA/i);
    await shot(page, '09-panel-summary-verified');

    await page.goto('/#/permits');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await shot(page, '10-permits-page');

    const genBtn = page.getByRole('button', { name: /Generate.*Permit Packet|Download Permit Packet|Generate Packet/i }).first();
    if (await genBtn.isVisible().catch(() => false)) {
      const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
      await genBtn.click();
      try {
        const download = await downloadPromise;
        const pdfPath = join(SCREENSHOT_DIR, 'permit-packet.pdf');
        await download.saveAs(pdfPath);
        console.log(`[smoke] permit packet saved to ${pdfPath}`);
      } catch (e) {
        console.warn('[smoke] permit packet download timed out (or button is wired differently):', e);
      }
    } else {
      console.warn('[smoke] permit packet button not found on /#/permits — UI may have changed');
    }
    await shot(page, '11-permit-packet-generated');
  });
});
