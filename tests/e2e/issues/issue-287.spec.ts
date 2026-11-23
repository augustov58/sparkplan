import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * #287 (owner ruling 2026-11-22): the riser legend (E-201) defines AIC as the
 * equipment interrupting rating, and no packet page says "Available
 * Interrupting Current". QA project "QA Short circuit" (read only).
 */

const OUT = 'tests/e2e/__output__/screenshots/issue-287';
mkdirSync(OUT, { recursive: true });

test('#287 the riser legend defines AIC as the equipment interrupting rating', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.setItem('welcomeModalDismissed', 'true'));
  await page.goto('/');
  const card = page.getByText('QA Short circuit', { exact: true }).first();
  await expect(card, 'QA project "QA Short circuit" (tests/e2e/fixtures.md) is missing').toBeVisible({ timeout: 15_000 });
  await card.click();
  await page.waitForURL(/#\/project\/[^/]+/);
  await page.goto(page.url().replace(/(#\/project\/[^/?]+).*/, '$1') + '/permit-packet');
  const generate = page.getByRole('button', { name: /Generate Permit Packet/i }).first();
  await expect(generate).toBeEnabled({ timeout: 20_000 });
  await page.waitForTimeout(2_000); // the generator reads the project's data after the button renders
  const download = page.waitForEvent('download', { timeout: 120_000 });
  await generate.click();
  const pdf = join(OUT, 'packet.pdf');
  await (await download).saveAs(pdf);
  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  const riser = text.split('\f').find(p => p.includes('Riser Diagram') && p.includes('LEGEND'))!;
  expect(riser).toContain('AIC = Ampere Interrupting Capacity (equipment interrupting rating, NEC 110.9)'); // main: Available Interrupting Current
  expect(text).not.toContain('Available Interrupting Current');
});
